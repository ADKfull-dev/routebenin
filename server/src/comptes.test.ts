/**
 * Mode comptes (COMPTES=oui), de bout en bout sur une base SQLite jetable :
 * inscription, connexion, isolation des entreprises, rôles, tentatives.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = 'file:./test-comptes.db';
process.env.DATABASE_URL = BASE;
process.env.COMPTES = 'oui';

let serveur: Server;
let url = '';

beforeAll(async () => {
  execSync('npx prisma db push --skip-generate --force-reset', { env: { ...process.env, DATABASE_URL: BASE }, stdio: 'ignore' });
  const { app } = await import('./app.js');
  serveur = app.listen(0);
  url = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api`;
}, 60_000);

afterAll(async () => {
  serveur?.close();
  const { prisma } = await import('./lib/prisma.js');
  await prisma.$disconnect();
  for (const f of ['test-comptes.db', 'test-comptes.db-journal']) rmSync(`prisma/${f}`, { force: true });
});

/** Petit client HTTP qui garde son cookie de session, comme un navigateur. */
function client() {
  let cookie = '';
  return async (chemin: string, options: { method?: string; corps?: unknown } = {}) => {
    const r = await fetch(url + chemin, {
      method: options.method ?? (options.corps ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const texte = await r.text();
    return { statut: r.status, corps: texte ? JSON.parse(texte) : null, setCookie: sc };
  };
}

const arret = (id: string, lat: number, lng: number) => ({ id, label: id, lat, lng });
const tournee = (nom: string) => ({
  nom,
  depart: arret('d', 6.35, 2.43),
  arrivee: null,
  destinations: [arret('a', 6.37, 2.41)],
  resultat: {
    etapes: [{ position: 0, arret: arret('d', 6.35, 2.43) }, { position: 1, arret: arret('a', 6.37, 2.41) }],
    distanceInitiale: 1000, distanceOptimisee: 900, gainMetres: 100, gainPourcent: 10,
    dureeSecondes: 300, nombreDestinations: 1, source: 'haversine', geometrie: null,
  },
});

describe('comptes et entreprises', () => {
  const alice = client(); // admin de « Boutique A »
  const bob = client(); // admin de « Boutique B »
  const carine = client(); // membre de « Boutique A »
  let idTourneeA = '';

  it('sans session : données refusées, état « non connecté »', async () => {
    const anonyme = client();
    expect((await anonyme('/tournees')).statut).toBe(401);
    expect((await anonyme('/auth/etat')).corps).toMatchObject({ comptes: true, utilisateur: null });
  });

  it('inscription : entreprise + administrateur, cookie httpOnly', async () => {
    const r = await alice('/auth/inscription', { corps: { entreprise: 'Boutique A', nom: 'Alice', email: 'Alice@A.bj', motDePasse: 'motdepasse-a' } });
    expect(r.statut).toBe(201);
    expect(r.setCookie).toMatch(/HttpOnly/);
    expect(r.corps.utilisateur).toMatchObject({ email: 'alice@a.bj', role: 'admin' });
    expect((await bob('/auth/inscription', { corps: { entreprise: 'Boutique B', nom: 'Bob', email: 'bob@b.bj', motDePasse: 'motdepasse-b' } })).statut).toBe(201);
  });

  it('refuse un e-mail déjà pris et un mot de passe trop court', async () => {
    const x = client();
    expect((await x('/auth/inscription', { corps: { entreprise: 'X', nom: 'X', email: 'alice@a.bj', motDePasse: 'motdepasse-x' } })).statut).toBe(409);
    expect((await x('/auth/inscription', { corps: { entreprise: 'X', nom: 'X', email: 'x@x.bj', motDePasse: 'court' } })).statut).toBe(400);
  });

  it('chaque entreprise ne voit que ses tournées', async () => {
    const r = await alice('/tournees', { corps: tournee('Tournée de A') });
    expect(r.statut).toBe(201);
    idTourneeA = r.corps.id;
    expect((await alice('/tournees')).corps.tournees).toHaveLength(1);
    expect((await bob('/tournees')).corps.tournees).toHaveLength(0);
    expect((await bob(`/tournees/${idTourneeA}`)).statut).toBe(404);
    expect((await bob(`/tournees/${idTourneeA}`, { method: 'DELETE' })).statut).toBe(404);
    expect((await bob('/stats')).corps.nombreTournees).toBe(0);
    expect((await alice('/stats')).corps.nombreTournees).toBe(1);
  });

  it('l’administrateur ajoute un membre, qui partage les tournées de l’entreprise', async () => {
    expect((await alice('/equipe', { corps: { nom: 'Carine', email: 'carine@a.bj', motDePasse: 'motdepasse-c' } })).statut).toBe(201);
    expect((await carine('/auth/connexion', { corps: { email: 'carine@a.bj', motDePasse: 'motdepasse-c' } })).statut).toBe(200);
    expect((await carine(`/tournees/${idTourneeA}`)).statut).toBe(200);
    expect((await carine('/equipe')).corps.membres.map((m: { nom: string }) => m.nom)).toEqual(['Alice', 'Carine']);
  });

  it('un membre ne gère ni l’équipe ni les réglages de l’entreprise', async () => {
    expect((await carine('/equipe', { corps: { nom: 'Z', email: 'z@a.bj', motDePasse: 'motdepasse-z' } })).statut).toBe(403);
    expect((await carine('/profil', { method: 'PUT', corps: { minutesParLivraison: 9 } })).statut).toBe(403);
    // …mais peut changer son propre nom.
    const r = await carine('/profil', { method: 'PUT', corps: { nomUtilisateur: 'Carine D.' } });
    expect(r.corps.profil).toMatchObject({ nomUtilisateur: 'Carine D.', nomEntreprise: 'Boutique A' });
  });

  it('l’administrateur règle l’entreprise ; l’autre entreprise n’est pas touchée', async () => {
    expect((await alice('/profil', { method: 'PUT', corps: { minutesParLivraison: 8, ville: 'Cotonou' } })).corps.profil).toMatchObject({ minutesParLivraison: 8 });
    expect((await bob('/profil')).corps.profil).toMatchObject({ nomEntreprise: 'Boutique B', minutesParLivraison: 5 });
  });

  it('un administrateur ne retire pas un membre d’une autre entreprise', async () => {
    const membres = (await alice('/equipe')).corps.membres as { id: string; nom: string }[];
    const idCarine = membres.find((m) => m.nom.startsWith('Carine'))!.id;
    expect((await bob(`/equipe/${idCarine}`, { method: 'DELETE' })).statut).toBe(404);
    expect((await alice(`/equipe/${membres[0].id}`, { method: 'DELETE' })).statut).toBe(400); // soi-même
    expect((await alice(`/equipe/${idCarine}`, { method: 'DELETE' })).statut).toBe(204);
    expect((await carine('/tournees')).statut).toBe(401); // sessions supprimées avec le compte
  });

  it('déconnexion puis mauvais mot de passe, limité à 10 essais', async () => {
    expect((await bob('/auth/deconnexion', { method: 'POST' })).statut).toBe(204);
    expect((await bob('/tournees')).statut).toBe(401);
    for (let i = 0; i < 10; i++) {
      expect((await bob('/auth/connexion', { corps: { email: 'bob@b.bj', motDePasse: 'faux' } })).statut).toBe(401);
    }
    expect((await bob('/auth/connexion', { corps: { email: 'bob@b.bj', motDePasse: 'motdepasse-b' } })).statut).toBe(429);
  });

  it('changement de mot de passe', async () => {
    expect((await alice('/auth/mot-de-passe', { method: 'PUT', corps: { actuel: 'faux', nouveau: 'nouveau-mdp-a' } })).statut).toBe(400);
    expect((await alice('/auth/mot-de-passe', { method: 'PUT', corps: { actuel: 'motdepasse-a', nouveau: 'nouveau-mdp-a' } })).statut).toBe(204);
    expect((await alice('/tournees')).statut).toBe(200); // session en cours conservée
    const autre = client();
    expect((await autre('/auth/connexion', { corps: { email: 'alice@a.bj', motDePasse: 'nouveau-mdp-a' } })).statut).toBe(200);
  });
});
