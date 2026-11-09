/**
 * auth.ts — comptes, sessions et contexte d'entreprise (mode COMPTES=oui).
 *
 *  - mots de passe : scrypt (node:crypto) avec sel aléatoire, comparaison en
 *    temps constant ; jamais stockés ni journalisés en clair ;
 *  - sessions : jeton aléatoire de 32 octets dans un cookie httpOnly
 *    SameSite=Lax ; la base ne garde que son SHA-256 ;
 *  - contexte : chaque requête porte l'entreprise de l'utilisateur, et toutes
 *    les requêtes de données sont filtrées dessus.
 *
 * En mode mono-utilisateur (défaut), le contexte est { entrepriseId: null } et
 * l'application se comporte comme avant.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { HttpError } from './http.js';

const scrypt = promisify(scryptCb) as (mdp: string, sel: Buffer, longueur: number) => Promise<Buffer>;

export const NOM_COOKIE = 'rb_session';
const DUREE_SESSION_MS = 30 * 24 * 3600 * 1000; // 30 jours

/* ---------- Mots de passe ---------- */

export async function hacherMotDePasse(mdp: string): Promise<string> {
  const sel = randomBytes(16);
  const empreinte = await scrypt(mdp, sel, 64);
  return `${sel.toString('hex')}:${empreinte.toString('hex')}`;
}

export async function verifierMotDePasse(mdp: string, stocke: string): Promise<boolean> {
  const [selHex, empreinteHex] = stocke.split(':');
  if (!selHex || !empreinteHex) return false;
  const attendu = Buffer.from(empreinteHex, 'hex');
  const calcule = await scrypt(mdp, Buffer.from(selHex, 'hex'), attendu.length);
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
}

/** Empreinte factice : même temps de calcul quand l'e-mail n'existe pas. */
let empreinteFactice: Promise<string> | null = null;
export const motDePasseFactice = () => (empreinteFactice ??= hacherMotDePasse(randomBytes(12).toString('hex')));

/* ---------- Sessions ---------- */

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function lireCookie(req: Request, nom: string): string | null {
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return decodeURIComponent(morceau.slice(i + 1).trim());
  }
  return null;
}

function ecrireCookie(res: Response, valeur: string, maxAgeS: number): void {
  const attributs = [`${NOM_COOKIE}=${encodeURIComponent(valeur)}`, 'Path=/api', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeS}`];
  if (env.COOKIE_SECURISE) attributs.push('Secure');
  res.setHeader('Set-Cookie', attributs.join('; '));
}

export async function ouvrirSession(res: Response, utilisateurId: string): Promise<void> {
  const jeton = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: { id: sha256(jeton), utilisateurId, expireLe: new Date(Date.now() + DUREE_SESSION_MS) },
  });
  ecrireCookie(res, jeton, DUREE_SESSION_MS / 1000);
}

export async function fermerSession(req: Request, res: Response): Promise<void> {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (jeton) await prisma.session.deleteMany({ where: { id: sha256(jeton) } });
  ecrireCookie(res, '', 0);
}

/* ---------- Contexte de requête ---------- */

export interface UtilisateurConnecte {
  id: string;
  nom: string;
  email: string;
  role: 'admin' | 'membre';
  entrepriseId: string;
}

export interface Contexte {
  /** null = mode mono-utilisateur. */
  entrepriseId: string | null;
  utilisateur: UtilisateurConnecte | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    contexte?: Contexte;
  }
}

/** Utilisateur de la session du cookie, ou null (absente, expirée, inconnue). */
export async function utilisateurDeLaRequete(req: Request): Promise<UtilisateurConnecte | null> {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (!jeton) return null;
  const session = await prisma.session.findUnique({ where: { id: sha256(jeton) }, include: { utilisateur: true } });
  if (!session) return null;
  if (session.expireLe.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const u = session.utilisateur;
  return { id: u.id, nom: u.nom, email: u.email, role: u.role === 'admin' ? 'admin' : 'membre', entrepriseId: u.entrepriseId };
}

/** Middleware : en mode comptes, exige une session valide et fixe le contexte. */
export async function exigerSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!env.COMPTES) {
    req.contexte = { entrepriseId: null, utilisateur: null };
    return next();
  }
  const utilisateur = await utilisateurDeLaRequete(req);
  if (!utilisateur) throw new HttpError(401, 'Connectez-vous pour continuer.');
  req.contexte = { entrepriseId: utilisateur.entrepriseId, utilisateur };
  next();
}

export function contexte(req: Request): Contexte {
  return req.contexte ?? { entrepriseId: null, utilisateur: null };
}

export function exigerAdmin(req: Request): UtilisateurConnecte {
  const u = contexte(req).utilisateur;
  if (!u || u.role !== 'admin') throw new HttpError(403, 'Réservé à l’administrateur de l’entreprise.');
  return u;
}

/* ---------- Limitation des tentatives de connexion ---------- */

const tentatives = new Map<string, { n: number; depuis: number }>();
const FENETRE_MS = 15 * 60 * 1000;
const MAX_TENTATIVES = 10;

/** Lève 429 au-delà de 10 échecs en 15 min pour une même clé (IP + e-mail). */
export function verifierTentatives(cle: string): void {
  const t = tentatives.get(cle);
  if (t && Date.now() - t.depuis < FENETRE_MS && t.n >= MAX_TENTATIVES) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
}

export function noterEchec(cle: string): void {
  const t = tentatives.get(cle);
  if (!t || Date.now() - t.depuis >= FENETRE_MS) tentatives.set(cle, { n: 1, depuis: Date.now() });
  else t.n++;
}

export const oublierTentatives = (cle: string) => tentatives.delete(cle);
