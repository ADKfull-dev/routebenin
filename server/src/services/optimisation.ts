/**
 * optimisation.ts — Orchestration de l'optimisation d'une tournée.
 *
 * Rôle : relier les services réseau (OSRM) et l'algorithme pur (tsp.ts).
 *  1. Construire la matrice de distances (OSRM si possible, sinon Haversine).
 *  2. Résoudre l'ordre optimal (Plus Proche Voisin + 2-opt).
 *  3. Calculer le gain « avant / après » et préparer le résultat d'affichage.
 *
 * Deux modes :
 *  - Boucle fermée : retour au point de départ (arrivée non précisée).
 *  - Chemin ouvert : arrivée différente du départ (on ne revient pas au départ).
 *    Géré par une réduction classique : on ajoute un nœud fictif relié
 *    uniquement au départ et à l'arrivée, transformant le chemin en cycle.
 */
import { solveTour, computeTourDistance } from '../algorithms/tsp.js';
import { matriceHaversine, type Coordonnee } from '../algorithms/distance.js';
import { matriceDistancesOSRM, traceItineraire } from './osrm.js';

export interface Arret {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export type SourceDistance = 'osrm' | 'haversine';

export interface EntreeOptimisation {
  depart: Arret;
  destinations: Arret[];
  arrivee: Arret | null;
  prefererOsrm: boolean;
}

export interface ResultatOptimisation {
  etapes: { position: number; arret: Arret }[];
  distanceInitiale: number;
  distanceOptimisee: number;
  gainMetres: number;
  gainPourcent: number;
  dureeSecondes: number | null;
  nombreDestinations: number;
  source: SourceDistance;
  geometrie: [number, number][] | null;
}

export class EntreeInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntreeInvalideError';
  }
}

const memeLieu = (a: Arret, b: Arret): boolean =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

/** Somme des distances le long d'un chemin (sans retour au départ). */
function distanceChemin(matrix: number[][], ordre: number[]): number {
  let total = 0;
  for (let i = 0; i < ordre.length - 1; i++) total += matrix[ordre[i]][ordre[i + 1]];
  return total;
}

/** Récupère la matrice de distances : OSRM si possible, sinon Haversine. */
async function obtenirMatrice(
  points: Coordonnee[],
  prefererOsrm: boolean,
): Promise<{ distances: number[][]; durations: number[][] | null; source: SourceDistance }> {
  if (prefererOsrm) {
    try {
      const { distances, durations } = await matriceDistancesOSRM(points);
      return { distances, durations, source: 'osrm' };
    } catch {
      // OSRM indisponible → repli silencieux sur Haversine (signalé via `source`).
    }
  }
  return { distances: matriceHaversine(points), durations: null, source: 'haversine' };
}

export async function optimiserTournee(
  entree: EntreeOptimisation,
): Promise<ResultatOptimisation> {
  const { depart, destinations, arrivee, prefererOsrm } = entree;

  if (!destinations || destinations.length < 1) {
    throw new EntreeInvalideError('Ajoutez au moins une destination à votre tournée.');
  }

  const arriveeDistincte = arrivee !== null && !memeLieu(arrivee, depart);

  // Liste ordonnée des nœuds réels (ordre de saisie).
  const noeuds: Arret[] = arriveeDistincte
    ? [depart, ...destinations, arrivee]
    : [depart, ...destinations];

  const coords: Coordonnee[] = noeuds.map((a) => ({ lat: a.lat, lng: a.lng }));
  const { distances, durations, source } = await obtenirMatrice(coords, prefererOsrm);

  const n = noeuds.length;
  let ordreOptimise: number[]; // indices dans `noeuds`
  let distanceOptimisee: number;
  let distanceInitiale: number;
  let noeudsItineraire: Arret[]; // points à tracer, dans l'ordre

  if (!arriveeDistincte) {
    // --- Boucle fermée : retour au départ inclus ---
    const ordreSaisie = noeuds.map((_, i) => i);
    distanceInitiale = computeTourDistance(distances, ordreSaisie);

    const res = solveTour(distances, 0);
    ordreOptimise = res.order;
    distanceOptimisee = res.totalDistance;

    // Tracé = ordre optimisé puis retour au départ.
    noeudsItineraire = [...ordreOptimise.map((i) => noeuds[i]), noeuds[ordreOptimise[0]]];
  } else {
    // --- Chemin ouvert : départ fixe → ... → arrivée fixe ---
    const depIdx = 0;
    const finIdx = n - 1;
    const fictif = n; // nœud fictif

    // Grande valeur finie (pas Infinity, pour garder une arithmétique sûre en 2-opt).
    let somme = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) somme += distances[i][j];
    const BIG = somme + 1;

    const aug: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) aug[i][j] = distances[i][j];
    for (let k = 0; k <= n; k++) {
      const cout = k === depIdx || k === finIdx ? 0 : BIG;
      aug[fictif][k] = cout;
      aug[k][fictif] = cout;
    }
    aug[fictif][fictif] = 0;

    const res = solveTour(aug, depIdx);
    // Réoriente le cycle pour qu'il commence au nœud fictif, puis on le retire.
    const cycle = res.order;
    const posFictif = cycle.indexOf(fictif);
    const tourne = [...cycle.slice(posFictif), ...cycle.slice(0, posFictif)]; // commence par fictif
    let chemin = tourne.slice(1); // retire le nœud fictif
    // `chemin` va d'un voisin du fictif à l'autre (départ ↔ arrivée).
    if (chemin[0] !== depIdx) chemin = chemin.slice().reverse();

    ordreOptimise = chemin;
    distanceOptimisee = distanceChemin(distances, chemin);

    const ordreSaisie = noeuds.map((_, i) => i);
    distanceInitiale = distanceChemin(distances, ordreSaisie);

    noeudsItineraire = ordreOptimise.map((i) => noeuds[i]);
  }

  // Durée estimée (uniquement si OSRM a fourni les durées).
  let dureeSecondes: number | null = null;
  if (durations) {
    dureeSecondes = 0;
    for (let i = 0; i < ordreOptimise.length - 1; i++) {
      dureeSecondes += durations[ordreOptimise[i]][ordreOptimise[i + 1]];
    }
    if (!arriveeDistincte) {
      dureeSecondes += durations[ordreOptimise[ordreOptimise.length - 1]][ordreOptimise[0]];
    }
  }

  // Gain (jamais négatif : l'optimisé ne peut pas être pire que la saisie).
  const gainMetres = Math.max(0, distanceInitiale - distanceOptimisee);
  const gainPourcent = distanceInitiale > 0 ? (gainMetres / distanceInitiale) * 100 : 0;

  // Tracé routier réel si OSRM est disponible ; sinon null (lignes droites côté carte).
  let geometrie: [number, number][] | null = null;
  if (source === 'osrm') {
    try {
      const trace = await traceItineraire(noeudsItineraire.map((a) => ({ lat: a.lat, lng: a.lng })));
      geometrie = trace.geometrie;
    } catch {
      geometrie = null;
    }
  }

  return {
    etapes: ordreOptimise.map((i, position) => ({ position, arret: noeuds[i] })),
    distanceInitiale,
    distanceOptimisee,
    gainMetres,
    gainPourcent,
    dureeSecondes,
    nombreDestinations: destinations.length,
    source,
    geometrie,
  };
}
