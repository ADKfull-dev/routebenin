/**
 * duree — durée réelle d'une tournée : temps de route (OSRM) + temps passé
 * sur place à chaque livraison (réglable dans les Paramètres, 5 min par défaut).
 */
import type { ResultatOptimisation } from '../types';

export const MINUTES_PAR_LIVRAISON_DEFAUT = 5;

export interface DureeTournee {
  /** Temps de conduite (s). */
  route: number;
  /** Temps sur place, toutes livraisons (s). */
  surPlace: number;
  /** Attente avant l'ouverture des créneaux (s). */
  attente: number;
  /** route + surPlace + attente (s). */
  total: number;
  minutesParLivraison: number;
}

export function minutesParLivraison(r: ResultatOptimisation): number {
  return r.minutesParLivraison ?? MINUTES_PAR_LIVRAISON_DEFAUT;
}

/** Durée d'une tournée simple (ou d'un livreur). `minutes` impose le temps par livraison. */
export function dureeTournee(r: ResultatOptimisation, minutes = minutesParLivraison(r)): DureeTournee | null {
  if (r.dureeSecondes === null) return null;
  const surPlace = minutes * 60 * r.nombreDestinations;
  const attente = r.horaires?.attenteTotale ?? 0;
  return { route: r.dureeSecondes, surPlace, attente, total: r.dureeSecondes + surPlace + attente, minutesParLivraison: minutes };
}

/**
 * Durée de la journée : en multi-livreurs, les livreurs roulent en parallèle,
 * donc c'est la tournée la plus longue (temps sur place compris) qui compte.
 */
export function dureeJournee(r: ResultatOptimisation): DureeTournee | null {
  const minutes = minutesParLivraison(r);
  if (!r.livreurs || r.livreurs.length <= 1) return dureeTournee(r, minutes);
  const durees = r.livreurs.map((l) => dureeTournee(l, minutes));
  if (durees.some((d) => d === null)) return null;
  return (durees as DureeTournee[]).reduce((a, b) => (b.total > a.total ? b : a));
}
