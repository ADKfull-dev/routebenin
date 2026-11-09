/**
 * Contrôleur des comptes : inscription d'une entreprise, connexion, équipe.
 * Actif seulement avec COMPTES=oui (voir lib/auth.ts).
 */
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { HttpError } from '../lib/http.js';
import {
  contexte,
  exigerAdmin,
  fermerSession,
  hacherMotDePasse,
  motDePasseFactice,
  noterEchec,
  oublierTentatives,
  ouvrirSession,
  utilisateurDeLaRequete,
  verifierMotDePasse,
  verifierTentatives,
} from '../lib/auth.js';
import { changementMotDePasseSchema, connexionSchema, inscriptionSchema, membreSchema } from '../lib/validation.js';

function valider<T extends z.ZodTypeAny>(schema: T, corps: unknown): z.infer<T> {
  const r = schema.safeParse(corps);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Données invalides.');
  return r.data;
}

function exigerComptes(): void {
  if (!env.COMPTES) throw new HttpError(404, 'Les comptes ne sont pas activés sur ce serveur.');
}

const vueUtilisateur = (u: { id: string; nom: string; email: string; role: string }) => ({
  id: u.id,
  nom: u.nom,
  email: u.email,
  role: u.role === 'admin' ? 'admin' : 'membre',
});

/** État de la session : le client sait s'il doit afficher la connexion. */
export async function etatSession(req: Request, res: Response): Promise<void> {
  if (!env.COMPTES) {
    res.json({ comptes: false, inscriptionsOuvertes: false, utilisateur: null, entreprise: null });
    return;
  }
  const u = await utilisateurDeLaRequete(req);
  const entreprise = u ? await prisma.entreprise.findUnique({ where: { id: u.entrepriseId }, select: { id: true, nom: true } }) : null;
  res.json({
    comptes: true,
    inscriptionsOuvertes: env.INSCRIPTIONS_OUVERTES,
    utilisateur: u ? vueUtilisateur(u) : null,
    entreprise,
  });
}

/** Crée une entreprise et son administrateur, puis ouvre la session. */
export async function inscription(req: Request, res: Response): Promise<void> {
  exigerComptes();
  if (!env.INSCRIPTIONS_OUVERTES) throw new HttpError(403, 'Les inscriptions sont fermées sur ce serveur.');
  const d = valider(inscriptionSchema, req.body);
  if (await prisma.utilisateur.findUnique({ where: { email: d.email } })) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }
  const premiere = (await prisma.entreprise.count()) === 0;
  const motDePasse = await hacherMotDePasse(d.motDePasse);
  const entreprise = await prisma.entreprise.create({
    data: { nom: d.entreprise, utilisateurs: { create: { nom: d.nom, email: d.email, motDePasse, role: 'admin' } } },
    include: { utilisateurs: true },
  });
  // Passage du mode mono-utilisateur aux comptes : la première entreprise
  // récupère l'historique existant et les réglages du profil unique.
  if (premiere) {
    await prisma.tournee.updateMany({ where: { entrepriseId: null }, data: { entrepriseId: entreprise.id } });
    const p = await prisma.profil.findUnique({ where: { id: 'profil' } });
    if (p) {
      await prisma.entreprise.update({
        where: { id: entreprise.id },
        data: { ville: p.ville, prefererOsrm: p.prefererOsrm, minutesParLivraison: p.minutesParLivraison },
      });
    }
  }
  const admin = entreprise.utilisateurs[0];
  await ouvrirSession(res, admin.id);
  res.status(201).json({ utilisateur: vueUtilisateur(admin), entreprise: { id: entreprise.id, nom: entreprise.nom } });
}

export async function connexion(req: Request, res: Response): Promise<void> {
  exigerComptes();
  const d = valider(connexionSchema, req.body);
  const cle = `${req.ip}|${d.email}`;
  verifierTentatives(cle);
  const u = await prisma.utilisateur.findUnique({ where: { email: d.email }, include: { entreprise: true } });
  const ok = await verifierMotDePasse(d.motDePasse, u?.motDePasse ?? (await motDePasseFactice()));
  if (!u || !ok) {
    noterEchec(cle);
    throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  }
  oublierTentatives(cle);
  await ouvrirSession(res, u.id);
  res.json({ utilisateur: vueUtilisateur(u), entreprise: { id: u.entreprise.id, nom: u.entreprise.nom } });
}

export async function deconnexion(req: Request, res: Response): Promise<void> {
  await fermerSession(req, res);
  res.status(204).end();
}

export async function changerMotDePasse(req: Request, res: Response): Promise<void> {
  exigerComptes();
  const moi = contexte(req).utilisateur!;
  const d = valider(changementMotDePasseSchema, req.body);
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: moi.id } });
  if (!(await verifierMotDePasse(d.actuel, u.motDePasse))) throw new HttpError(400, 'Mot de passe actuel incorrect.');
  await prisma.utilisateur.update({ where: { id: u.id }, data: { motDePasse: await hacherMotDePasse(d.nouveau) } });
  // Les autres appareils sont déconnectés ; la session en cours est rouverte.
  await prisma.session.deleteMany({ where: { utilisateurId: u.id } });
  await ouvrirSession(res, u.id);
  res.status(204).end();
}

/* ---------- Équipe ---------- */

export async function listerEquipe(req: Request, res: Response): Promise<void> {
  exigerComptes();
  const { entrepriseId } = contexte(req);
  const membres = await prisma.utilisateur.findMany({
    where: { entrepriseId: entrepriseId! },
    orderBy: { creeLe: 'asc' },
    select: { id: true, nom: true, email: true, role: true, creeLe: true },
  });
  res.json({ membres: membres.map((m) => ({ ...vueUtilisateur(m), creeLe: m.creeLe })) });
}

/** L'administrateur crée le compte d'un membre et lui transmet le mot de passe. */
export async function ajouterMembre(req: Request, res: Response): Promise<void> {
  exigerComptes();
  const admin = exigerAdmin(req);
  const d = valider(membreSchema, req.body);
  if (await prisma.utilisateur.findUnique({ where: { email: d.email } })) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }
  const m = await prisma.utilisateur.create({
    data: { nom: d.nom, email: d.email, role: d.role, motDePasse: await hacherMotDePasse(d.motDePasse), entrepriseId: admin.entrepriseId },
  });
  res.status(201).json({ membre: { ...vueUtilisateur(m), creeLe: m.creeLe } });
}

export async function retirerMembre(req: Request, res: Response): Promise<void> {
  exigerComptes();
  const admin = exigerAdmin(req);
  if (req.params.id === admin.id) throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre compte.');
  const m = await prisma.utilisateur.findFirst({ where: { id: req.params.id, entrepriseId: admin.entrepriseId } });
  if (!m) throw new HttpError(404, 'Membre introuvable.');
  await prisma.utilisateur.delete({ where: { id: m.id } });
  res.status(204).end();
}
