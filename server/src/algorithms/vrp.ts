/**
 * vrp.ts — Répartition d'une tournée entre plusieurs livreurs (VRP).
 *
 * Problème : K livreurs partent du même dépôt et y reviennent. Il faut
 * répartir les destinations entre eux et ordonner chaque tournée.
 *
 * Deux critères, au choix :
 *  - « charges équilibrées » (défaut) : la charge d'un livreur est
 *        wᵢ = coût de sa tournée + C × nombre d'arrêts
 *    où le coût est la DURÉE de conduite (matrice des durées OSRM) et
 *    C = 5 min passées à chaque livraison. Sans durées (repli vol d'oiseau),
 *    on raisonne en distance avec C = 2 km (≈ 5 min à 25 km/h en ville).
 *    On minimise Σ wᵢ². Comme
 *        Σ wᵢ² = K · (moyenne² + variance),
 *    ce critère réduit à la fois la charge totale ET l'écart entre livreurs,
 *    sans jamais récompenser un détour (allonger une tournée augmente Σ wᵢ²).
 *    Chaque livreur garde au moins un arrêt ; le nombre d'arrêts peut varier.
 *  - « même nombre d'arrêts » : minimiser la distance totale avec au plus
 *    ⌈n / K⌉ arrêts par livreur.
 *
 * Méthode « grouper d'abord, ordonner ensuite » (cluster-first, route-second),
 * entièrement codée ici :
 *   1. Balayage angulaire (sweep, Gillett & Miller 1974) : on trie les
 *      destinations par angle autour du dépôt puis on découpe ce cercle en K
 *      secteurs contigus. On essaie TOUS les points de départ du balayage et
 *      on garde le meilleur découpage selon le critère choisi.
 *   2. Chaque secteur est ordonné par le moteur TSP (PPV + 2-opt + Or-opt).
 *   3. Amélioration inter-tournées : on déplace un point d'une tournée à une
 *      autre (relocate) ou on échange deux points (swap) tant que le critère
 *      diminue et que les contraintes sont respectées.
 *
 * Module pur : matrice de distances + coordonnées en entrée, aucun réseau.
 */
import { solveTour, computeTourDistance } from './tsp.js';

export interface PointPlan {
  lat: number;
  lng: number;
}

export type CritereVrp = 'equilibre' | 'arrets';

export interface ResultatVrp {
  /** Une tournée par livreur : indices de la matrice, dépôt en tête (boucle fermée). */
  tournees: number[][];
  /** Distance de chaque tournée (retour au dépôt inclus). */
  distances: number[];
  /** Somme des distances. */
  total: number;
  /** Plus longue tournée. */
  max: number;
}

const EPS = 1e-9;
/** Temps de service d'un arrêt quand la matrice est en secondes (5 min). */
export const COUT_ARRET_S = 300;
/** Temps de service d'un arrêt en mètres équivalents, quand la matrice est en mètres (5 min ≈ 2 km en ville). */
export const COUT_ARRET_M = 2000;

/** Distance d'une tournée fermée (dépôt + arrêts). */
const longueur = (D: number[][], t: number[]) => computeTourDistance(D, t);

/** Charge de travail d'un livreur : conduite + temps de service aux arrêts. */
export const charge = (cout: number, arrets: number, coutArret = COUT_ARRET_M) => cout + coutArret * arrets;

/** Valeur du critère à minimiser (longueurs et nombres d'arrêts par tournée). */
export function coutRepartition(
  couts: number[],
  arrets: number[],
  critere: CritereVrp,
  coutArret = COUT_ARRET_M,
): number {
  if (critere === 'arrets') return couts.reduce((s, d) => s + d, 0);
  // Σ wᵢ² (mis à l'échelle /1000 pour garder des nombres raisonnables)
  return couts.reduce((s, d, i) => s + (charge(d, arrets[i], coutArret) / 1000) ** 2, 0);
}

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
function balayage(
  D: number[][],
  points: PointPlan[],
  depot: number,
  k: number,
  critere: CritereVrp,
  coutArret: number,
): number[][] {
  const a = angles(points, depot);
  const destinations = points.map((_, i) => i).filter((i) => i !== depot);
  destinations.sort((i, j) => a[i] - a[j]);
  const n = destinations.length;
  const tailles = taillesEquilibrees(n, k);

  let meilleur: number[][] = [];
  let meilleurCout = Infinity;
  for (let debut = 0; debut < n; debut++) {
    const cercle = [...destinations.slice(debut), ...destinations.slice(0, debut)];
    const tournees: number[][] = [];
    let pos = 0;
    for (const t of tailles) {
      tournees.push(ordonnerGroupe(D, depot, cercle.slice(pos, pos + t)));
      pos += t;
    }
    const cout = coutRepartition(tournees.map((t) => longueur(D, t)), tournees.map((t) => t.length - 1), critere, coutArret);
    if (cout < meilleurCout - EPS) {
      meilleurCout = cout;
      meilleur = tournees;
    }
  }
  return meilleur;
}

/** Étape 3 : relocate + swap entre tournées, jusqu'à stabilité. */
function ameliorerEntreTournees(
  D: number[][],
  depot: number,
  tournees: number[][],
  critere: CritereVrp,
  capacite: number,
  coutArret: number,
): number[][] {
  const t = tournees.map((x) => x.slice());
  const dist = t.map((x) => longueur(D, x));
  const arrets = (i: number) => t[i].slice(1);
  const nbArrets = () => t.map((x) => x.length - 1);
  /** Critère si les tournées a et b devenaient nouvA / nouvB. */
  const coutAvec = (a: number, nouvA: number[], dA: number, b: number, nouvB: number[], dB: number) =>
    coutRepartition(
      dist.map((d, i) => (i === a ? dA : i === b ? dB : d)),
      t.map((x, i) => (i === a ? nouvA.length : i === b ? nouvB.length : x.length) - 1),
      critere,
      coutArret,
    );

  let coutCourant = coutRepartition(dist, nbArrets(), critere, coutArret);
  const appliquer = (a: number, nouvA: number[], dA: number, b: number, nouvB: number[], dB: number) => {
    t[a] = nouvA;
    t[b] = nouvB;
    dist[a] = dA;
    dist[b] = dB;
    coutCourant = coutRepartition(dist, nbArrets(), critere, coutArret);
  };

  let ameliore = true;
  let garde = 0;
  while (ameliore && garde++ < 500) {
    ameliore = false;

    // Relocate : déplacer un arrêt de la tournée a vers la tournée b.
    for (let a = 0; a < t.length && !ameliore; a++) {
      if (t[a].length - 1 <= 1) continue; // chaque livreur garde au moins un arrêt
      for (const p of arrets(a)) {
        if (ameliore) break;
        for (let b = 0; b < t.length; b++) {
          if (b === a || t[b].length - 1 >= capacite) continue;
          const nouvA = ordonnerGroupe(D, depot, arrets(a).filter((x) => x !== p));
          const nouvB = ordonnerGroupe(D, depot, [...arrets(b), p]);
          const dA = longueur(D, nouvA);
          const dB = longueur(D, nouvB);
          if (coutAvec(a, nouvA, dA, b, nouvB, dB) < coutCourant - EPS) {
            appliquer(a, nouvA, dA, b, nouvB, dB);
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
            if (coutAvec(a, nouvA, dA, b, nouvB, dB) < coutCourant - EPS) {
              appliquer(a, nouvA, dA, b, nouvB, dB);
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
 * @param D        matrice des distances (carrée)
 * @param points   coordonnées de chaque nœud (même indexation que D)
 * @param depot    indice du dépôt (point de départ commun)
 * @param k        nombre de livreurs (borné au nombre de destinations)
 * @param critere  « equilibre » (défaut) ou « arrets » (voir en-tête)
 * @param options.durees  matrice des durées (s) : si fournie, « equilibre »
 *                        équilibre le TEMPS de travail (conduite + 5 min/arrêt)
 */
export function repartirTournees(
  D: number[][],
  points: PointPlan[],
  depot: number,
  k: number,
  critere: CritereVrp = 'equilibre',
  options: { durees?: number[][] | null } = {},
): ResultatVrp {
  const n = D.length - 1; // destinations
  if (n < 1) return { tournees: [[depot]], distances: [0], total: 0, max: 0 };
  const livreurs = Math.max(1, Math.min(Math.floor(k), n));

  let tournees: number[][];
  if (livreurs === 1) {
    tournees = [solveTour(D, depot).order];
  } else {
    // Solution « même nombre d'arrêts » : balayage + amélioration sous plafond ⌈n/K⌉.
    const parArrets = ameliorerEntreTournees(
      D, depot, balayage(D, points, depot, livreurs, 'arrets', 0), 'arrets', Math.ceil(n / livreurs), 0,
    );
    if (critere === 'arrets') {
      tournees = parArrets;
    } else {
      // « Charges équilibrées » : en temps si les durées sont connues, sinon en distance.
      const C = options.durees ?? D;
      const coutArret = options.durees ? COUT_ARRET_S : COUT_ARRET_M;
      // Recherche locale depuis deux points de départ (balayage dédié, et la
      // solution à nombre d'arrêts égal) ; on garde la meilleure.
      const cout = (t: number[][]) =>
        coutRepartition(t.map((x) => longueur(C, x)), t.map((x) => x.length - 1), 'equilibre', coutArret);
      const candidats = [
        ameliorerEntreTournees(C, depot, balayage(C, points, depot, livreurs, 'equilibre', coutArret), 'equilibre', n, coutArret),
        ameliorerEntreTournees(C, depot, parArrets, 'equilibre', n, coutArret),
      ];
      tournees = cout(candidats[0]) <= cout(candidats[1]) ? candidats[0] : candidats[1];
    }
  }
  const distances = tournees.map((x) => longueur(D, x));
  return { tournees, distances, total: distances.reduce((s, d) => s + d, 0), max: Math.max(...distances) };
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
