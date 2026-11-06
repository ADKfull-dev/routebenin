/**
 * vrp.ts — Répartition d'une tournée entre plusieurs livreurs (VRP).
 *
 * Problème : K livreurs partent du même dépôt et y reviennent. Il faut
 * répartir les destinations entre eux et ordonner chaque tournée, en
 * minimisant la distance totale tout en gardant des charges équilibrées
 * (chaque livreur a au plus ⌈n / K⌉ arrêts).
 *
 * Méthode « grouper d'abord, ordonner ensuite » (cluster-first, route-second),
 * entièrement codée ici :
 *   1. Balayage angulaire (sweep, Gillett & Miller 1974) : on trie les
 *      destinations par angle autour du dépôt puis on découpe ce cercle en K
 *      secteurs contigus de tailles équilibrées. On essaie TOUS les points de
 *      départ du balayage et on garde le meilleur découpage.
 *   2. Chaque secteur est ordonné par le moteur TSP (PPV + 2-opt + Or-opt).
 *   3. Amélioration inter-tournées : on déplace un point d'une tournée à une
 *      autre (relocate) ou on échange deux points (swap) tant que la distance
 *      totale diminue et que la contrainte de charge est respectée.
 *
 * Module pur : matrice de distances + coordonnées en entrée, aucun réseau.
 */
import { solveTour, computeTourDistance } from './tsp.js';

export interface PointPlan {
  lat: number;
  lng: number;
}

export interface ResultatVrp {
  /** Une tournée par livreur : indices de la matrice, dépôt en tête (boucle fermée). */
  tournees: number[][];
  /** Distance de chaque tournée (retour au dépôt inclus). */
  distances: number[];
  /** Somme des distances. */
  total: number;
}

const EPS = 1e-9;

/** Distance d'une tournée fermée (dépôt + arrêts). */
const longueur = (D: number[][], t: number[]) => computeTourDistance(D, t);

/**
 * Ordonne un groupe d'arrêts en tournée optimale partant du dépôt.
 * Le TSP est résolu sur la sous-matrice du groupe.
 */
export function ordonnerGroupe(D: number[][], depot: number, arrets: number[]): number[] {
  if (arrets.length === 0) return [depot];
  const noeuds = [depot, ...arrets];
  const sous = noeuds.map((i) => noeuds.map((j) => D[i][j]));
  return solveTour(sous, 0).order.map((k) => noeuds[k]);
}

/** Tailles équilibrées : n arrêts en k groupes (les premiers prennent le reste). */
export function taillesEquilibrees(n: number, k: number): number[] {
  const base = Math.floor(n / k);
  const reste = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < reste ? 1 : 0));
}

/** Angle de chaque point autour du dépôt (projection équirectangulaire locale). */
function angles(points: PointPlan[], depot: number): number[] {
  const o = points[depot];
  const cosLat = Math.cos((o.lat * Math.PI) / 180);
  return points.map((p) => Math.atan2(p.lat - o.lat, (p.lng - o.lng) * cosLat));
}

/** Étape 1 + 2 : balayage angulaire, meilleur point de départ, TSP par secteur. */
function balayage(D: number[][], points: PointPlan[], depot: number, k: number): number[][] {
  const a = angles(points, depot);
  const destinations = points.map((_, i) => i).filter((i) => i !== depot);
  destinations.sort((i, j) => a[i] - a[j]);
  const n = destinations.length;
  const tailles = taillesEquilibrees(n, k);

  let meilleur: number[][] = [];
  let meilleurTotal = Infinity;
  for (let debut = 0; debut < n; debut++) {
    const cercle = [...destinations.slice(debut), ...destinations.slice(0, debut)];
    const tournees: number[][] = [];
    let pos = 0;
    let total = 0;
    for (const t of tailles) {
      const groupe = cercle.slice(pos, pos + t);
      pos += t;
      const tour = ordonnerGroupe(D, depot, groupe);
      total += longueur(D, tour);
      tournees.push(tour);
      if (total >= meilleurTotal) break; // élagage : déjà pire
    }
    if (tournees.length === k && total < meilleurTotal - EPS) {
      meilleurTotal = total;
      meilleur = tournees;
    }
  }
  return meilleur;
}

/** Étape 3 : relocate + swap entre tournées, jusqu'à stabilité. */
function ameliorerEntreTournees(D: number[][], depot: number, tournees: number[][], capacite: number): number[][] {
  const t = tournees.map((x) => x.slice());
  const dist = t.map((x) => longueur(D, x));
  const arrets = (i: number) => t[i].slice(1);

  let ameliore = true;
  let garde = 0;
  while (ameliore && garde++ < 200) {
    ameliore = false;

    // Relocate : déplacer un arrêt de la tournée a vers la tournée b.
    for (let a = 0; a < t.length && !ameliore; a++) {
      for (const p of arrets(a)) {
        if (ameliore) break;
        for (let b = 0; b < t.length; b++) {
          if (b === a || t[b].length - 1 >= capacite) continue;
          const nouvA = ordonnerGroupe(D, depot, arrets(a).filter((x) => x !== p));
          const nouvB = ordonnerGroupe(D, depot, [...arrets(b), p]);
          const dA = longueur(D, nouvA);
          const dB = longueur(D, nouvB);
          if (dA + dB < dist[a] + dist[b] - EPS) {
            t[a] = nouvA;
            t[b] = nouvB;
            dist[a] = dA;
            dist[b] = dB;
            ameliore = true;
            break;
          }
        }
      }
    }
    if (ameliore) continue;

    // Swap : échanger un arrêt de a avec un arrêt de b (charges inchangées).
    for (let a = 0; a < t.length && !ameliore; a++) {
      for (let b = a + 1; b < t.length && !ameliore; b++) {
        for (const p of arrets(a)) {
          if (ameliore) break;
          for (const q of arrets(b)) {
            const nouvA = ordonnerGroupe(D, depot, [...arrets(a).filter((x) => x !== p), q]);
            const nouvB = ordonnerGroupe(D, depot, [...arrets(b).filter((x) => x !== q), p]);
            const dA = longueur(D, nouvA);
            const dB = longueur(D, nouvB);
            if (dA + dB < dist[a] + dist[b] - EPS) {
              t[a] = nouvA;
              t[b] = nouvB;
              dist[a] = dA;
              dist[b] = dB;
              ameliore = true;
              break;
            }
          }
        }
      }
    }
  }
  return t;
}

/**
 * Répartit les points entre `k` livreurs partant tous de `depot`.
 *
 * @param D       matrice des distances (carrée)
 * @param points  coordonnées de chaque nœud (même indexation que D)
 * @param depot   indice du dépôt (point de départ commun)
 * @param k       nombre de livreurs (borné au nombre de destinations)
 */
export function repartirTournees(D: number[][], points: PointPlan[], depot: number, k: number): ResultatVrp {
  const n = D.length - 1; // destinations
  if (n < 1) return { tournees: [[depot]], distances: [0], total: 0 };
  const livreurs = Math.max(1, Math.min(Math.floor(k), n));

  let tournees: number[][];
  if (livreurs === 1) {
    tournees = [solveTour(D, depot).order];
  } else {
    const capacite = Math.ceil(n / livreurs);
    tournees = ameliorerEntreTournees(D, depot, balayage(D, points, depot, livreurs), capacite);
  }
  const distances = tournees.map((x) => longueur(D, x));
  return { tournees, distances, total: distances.reduce((s, d) => s + d, 0) };
}

/**
 * Répartition « naïve » de référence (pour mesurer le gain) : les destinations
 * dans l'ordre de saisie, découpées en k blocs consécutifs, chaque bloc
 * parcouru dans l'ordre de saisie.
 */
export function repartitionNaive(D: number[][], depot: number, k: number): number {
  const destinations = D.map((_, i) => i).filter((i) => i !== depot);
  const livreurs = Math.max(1, Math.min(Math.floor(k), destinations.length));
  let pos = 0;
  let total = 0;
  for (const taille of taillesEquilibrees(destinations.length, livreurs)) {
    total += longueur(D, [depot, ...destinations.slice(pos, pos + taille)]);
    pos += taille;
  }
  return total;
}
