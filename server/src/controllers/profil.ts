/**
 * Contrôleur du profil (informations utilisateur / entreprise, préférences).
 * Application mono-utilisateur : un seul profil, d'identifiant fixe "profil".
 */
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { profilSchema } from '../lib/validation.js';
import { HttpError } from '../lib/http.js';

const ID_PROFIL = 'profil';

async function profilParDefaut() {
  return prisma.profil.upsert({
    where: { id: ID_PROFIL },
    create: { id: ID_PROFIL },
    update: {},
  });
}

export async function obtenirProfil(_req: Request, res: Response): Promise<void> {
  const profil = await profilParDefaut();
  res.json({ profil });
}

export async function mettreAJourProfil(req: Request, res: Response): Promise<void> {
  const parse = profilSchema.safeParse(req.body);
  if (!parse.success) {
    const premier = parse.error.issues[0];
    throw new HttpError(400, premier?.message ?? 'Données de profil invalides.');
  }
  await profilParDefaut();
  const profil = await prisma.profil.update({
    where: { id: ID_PROFIL },
    data: parse.data,
  });
  res.json({ profil });
}
