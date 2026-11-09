/**
 * Contrôleur du profil (informations utilisateur / entreprise, préférences).
 *  - mode mono-utilisateur : un seul profil, d'identifiant fixe "profil" ;
 *  - mode comptes : nom de la personne connectée + réglages de son entreprise
 *    (modifiables par l'administrateur seulement).
 */
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { profilSchema } from '../lib/validation.js';
import { HttpError } from '../lib/http.js';
import { contexte } from '../lib/auth.js';

const ID_PROFIL = 'profil';

async function profilParDefaut() {
  return prisma.profil.upsert({
    where: { id: ID_PROFIL },
    create: { id: ID_PROFIL },
    update: {},
  });
}

async function profilEntreprise(utilisateurId: string, entrepriseId: string) {
  const [u, e] = await Promise.all([
    prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } }),
    prisma.entreprise.findUniqueOrThrow({ where: { id: entrepriseId } }),
  ]);
  return {
    id: e.id,
    nomUtilisateur: u.nom,
    nomEntreprise: e.nom,
    ville: e.ville,
    prefererOsrm: e.prefererOsrm,
    minutesParLivraison: e.minutesParLivraison,
  };
}

export async function obtenirProfil(req: Request, res: Response): Promise<void> {
  const { utilisateur } = contexte(req);
  res.json({ profil: utilisateur ? await profilEntreprise(utilisateur.id, utilisateur.entrepriseId) : await profilParDefaut() });
}

export async function mettreAJourProfil(req: Request, res: Response): Promise<void> {
  const parse = profilSchema.safeParse(req.body);
  if (!parse.success) {
    const premier = parse.error.issues[0];
    throw new HttpError(400, premier?.message ?? 'Données de profil invalides.');
  }
  const { utilisateur } = contexte(req);
  if (!utilisateur) {
    await profilParDefaut();
    const profil = await prisma.profil.update({ where: { id: ID_PROFIL }, data: parse.data });
    res.json({ profil });
    return;
  }

  const { nomUtilisateur, nomEntreprise, ...reglages } = parse.data;
  if (nomUtilisateur?.trim()) {
    await prisma.utilisateur.update({ where: { id: utilisateur.id }, data: { nom: nomUtilisateur.trim() } });
  }
  const actuel = await profilEntreprise(utilisateur.id, utilisateur.entrepriseId);
  const modifs = {
    ...(nomEntreprise?.trim() && nomEntreprise.trim() !== actuel.nomEntreprise ? { nom: nomEntreprise.trim() } : {}),
    ...Object.fromEntries(
      Object.entries(reglages).filter(([k, v]) => v !== undefined && v !== actuel[k as keyof typeof actuel]),
    ),
  };
  if (Object.keys(modifs).length > 0) {
    if (utilisateur.role !== 'admin') {
      throw new HttpError(403, 'Seul l’administrateur peut modifier les réglages de l’entreprise.');
    }
    await prisma.entreprise.update({ where: { id: utilisateur.entrepriseId }, data: modifs });
  }
  res.json({ profil: await profilEntreprise(utilisateur.id, utilisateur.entrepriseId) });
}
