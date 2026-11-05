/**
 * Contrôleur des tournées sauvegardées (historique) et des statistiques.
 */
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sauvegardeSchema } from '../lib/validation.js';
import { HttpError } from '../lib/http.js';

/** Liste résumée des tournées (pour l'historique), plus récentes d'abord. */
export async function listerTournees(_req: Request, res: Response): Promise<void> {
  const tournees = await prisma.tournee.findMany({
    orderBy: { creeLe: 'desc' },
    select: {
      id: true,
      nom: true,
      creeLe: true,
      nombreDestinations: true,
      distanceOptimisee: true,
      gainMetres: true,
      gainPourcent: true,
      source: true,
    },
  });
  res.json({ tournees });
}

/** Détail complet d'une tournée (données + résultat désérialisés). */
export async function obtenirTournee(req: Request, res: Response): Promise<void> {
  const t = await prisma.tournee.findUnique({ where: { id: req.params.id } });
  if (!t) throw new HttpError(404, 'Tournée introuvable.');

  res.json({
    tournee: {
      id: t.id,
      nom: t.nom,
      creeLe: t.creeLe,
      depart: JSON.parse(t.departJson),
      arrivee: t.arriveeJson ? JSON.parse(t.arriveeJson) : null,
      destinations: JSON.parse(t.destinationsJson),
      resultat: JSON.parse(t.resultatJson),
    },
  });
}

/** Sauvegarde une tournée optimisée. */
export async function sauvegarderTournee(req: Request, res: Response): Promise<void> {
  const parse = sauvegardeSchema.safeParse(req.body);
  if (!parse.success) {
    const premier = parse.error.issues[0];
    throw new HttpError(400, premier?.message ?? 'Données de sauvegarde invalides.');
  }
  const { nom, depart, arrivee, destinations, resultat } = parse.data;

  const t = await prisma.tournee.create({
    data: {
      nom,
      departJson: JSON.stringify(depart),
      arriveeJson: arrivee ? JSON.stringify(arrivee) : null,
      destinationsJson: JSON.stringify(destinations),
      resultatJson: JSON.stringify(resultat),
      nombreDestinations: resultat.nombreDestinations,
      distanceInitiale: resultat.distanceInitiale,
      distanceOptimisee: resultat.distanceOptimisee,
      gainMetres: resultat.gainMetres,
      gainPourcent: resultat.gainPourcent,
      source: resultat.source,
    },
  });
  res.status(201).json({ id: t.id });
}

/** Supprime une tournée. */
export async function supprimerTournee(req: Request, res: Response): Promise<void> {
  try {
    await prisma.tournee.delete({ where: { id: req.params.id } });
  } catch {
    throw new HttpError(404, 'Tournée introuvable.');
  }
  res.status(204).end();
}

/** Statistiques agrégées pour le tableau de bord. */
export async function statistiques(_req: Request, res: Response): Promise<void> {
  const agg = await prisma.tournee.aggregate({
    _count: { _all: true },
    _sum: { distanceOptimisee: true, gainMetres: true },
    _avg: { gainPourcent: true },
  });

  const dernieres = await prisma.tournee.findMany({
    orderBy: { creeLe: 'desc' },
    take: 5,
    select: {
      id: true,
      nom: true,
      creeLe: true,
      nombreDestinations: true,
      distanceOptimisee: true,
      gainPourcent: true,
    },
  });

  res.json({
    nombreTournees: agg._count._all,
    distanceTotale: agg._sum.distanceOptimisee ?? 0,
    gainTotal: agg._sum.gainMetres ?? 0,
    tauxMoyenOptimisation: agg._avg.gainPourcent ?? 0,
    dernieres,
  });
}
