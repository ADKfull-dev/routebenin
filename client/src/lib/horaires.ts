/**
 * horaires — passage des arrêts saisis (créneaux « HH:MM », colis) aux
 * contraintes du moteur (contraintes.ts), et des simulations aux horaires
 * affichés. Miroir de server/src/services/optimisation.ts.
 */
import type { Arret, Horaires } from '../types';
import type { EntreeOptimisation } from './apiTypes';
import { aDesFenetres, dureesDepuisDistances, heureEnSecondes, type Contraintes, type Simulation } from './contraintes';

export const HEURE_DEPART_DEFAUT = 8 * 3600;

/** Contraintes de la tournée, indexées comme `noeuds` (départ en 0). */
export function construireContraintes(
  noeuds: Arret[],
  distances: number[][],
  durations: number[][] | null,
  entree: EntreeOptimisation,
  secondesParArret: number,
  indexArrivee: number | null,
): Contraintes {
  return {
    durees: durations ?? dureesDepuisDistances(distances),
    heureDepart: heureEnSecondes(entree.heureDepart) ?? HEURE_DEPART_DEFAUT,
    service: secondesParArret,
    fenetres: noeuds.map((a, i) => {
      if (i === 0 || i === indexArrivee || !a.fenetre) return null;
      const debut = heureEnSecondes(a.fenetre.debut);
      const fin = heureEnSecondes(a.fenetre.fin);
      return debut === null && fin === null ? null : { debut, fin };
    }),
    demandes: noeuds.map((a, i) => (i === 0 || i === indexArrivee ? 0 : Math.max(0, a.colis ?? 1))),
    capacite: entree.capaciteVehicule ?? null,
  };
}

export function versHoraires(s: Simulation, c: Contraintes, estime: boolean): Horaires {
  return {
    heureDepart: c.heureDepart,
    heureFin: s.heureFin,
    passages: s.passages.map(({ arrivee, attente, retard }) => ({ arrivee, attente, retard })),
    retards: s.nombreRetards,
    retardTotal: s.retardTotal,
    attenteTotale: s.passages.reduce((t, p) => t + p.attente, 0),
    charge: s.charge,
    capacite: c.capacite,
    avecFenetres: aDesFenetres(c),
    estime,
  };
}

/** Secondes depuis minuit → « 09:42 » (au-delà de minuit : « 00:15 (+1 j) »). */
export function formatHeure(s: number): string {
  const total = Math.round(s / 60);
  const jours = Math.floor(total / 1440);
  const m = total % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}${jours > 0 ? ` (+${jours} j)` : ''}`;
}

/** Créneau lisible : « 10:00–12:00 », « avant 12:00 », « après 14:00 », ou null. */
export function libelleFenetre(f: Arret['fenetre']): string | null {
  if (!f || (!f.debut && !f.fin)) return null;
  if (f.debut && f.fin) return `${f.debut}–${f.fin}`;
  return f.fin ? `avant ${f.fin}` : `après ${f.debut}`;
}

export interface ResumeHoraires {
  heureDepart: number;
  /** Dernier retour (le plus tard des livreurs). */
  heureFin: number;
  retards: number;
  retardTotal: number;
  avecFenetres: boolean;
  estime: boolean;
  capacite: number | null;
  /** Colis du livreur le plus chargé (ou de la tournée). */
  chargeMax: number;
  /** Livreurs dont le chargement dépasse la capacité. */
  surcharges: number;
}

/** Synthèse des horaires d'un résultat (tournée unique ou tous les livreurs). */
export function resumeHoraires(r: { horaires?: Horaires | null; livreurs?: { horaires?: Horaires | null }[] | null }): ResumeHoraires | null {
  const liste = r.livreurs && r.livreurs.length > 1 ? r.livreurs.map((l) => l.horaires) : [r.horaires];
  if (liste.some((h) => !h)) return null;
  const h = liste as Horaires[];
  const capacite = h[0].capacite;
  return {
    heureDepart: h[0].heureDepart,
    heureFin: Math.max(...h.map((x) => x.heureFin)),
    retards: h.reduce((s, x) => s + x.retards, 0),
    retardTotal: h.reduce((s, x) => s + x.retardTotal, 0),
    avecFenetres: h.some((x) => x.avecFenetres),
    estime: h.some((x) => x.estime),
    capacite,
    chargeMax: Math.max(...h.map((x) => x.charge)),
    surcharges: capacite === null ? 0 : h.filter((x) => x.charge > capacite).length,
  };
}

/** « 12 min » à partir de secondes (arrondi à la minute, au moins 1). */
export const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;
