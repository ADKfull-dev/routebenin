/**
 * contraintes.ts — Tournées avec FENÊTRES HORAIRES et CAPACITÉ du véhicule
 * (VRPTW capacitaire, résolu par heuristique).
 *
 * Données :
 *  - matrice des durées T (secondes) entre tous les points ;
 *  - heure de départ du dépôt, temps de service s passé à chaque livraison ;
 *  - pour chaque livraison : une fenêtre [début, fin] optionnelle (« livrer
 *    entre 10:00 et 12:00 ») et une demande (nombre de colis) ;
 *  - une capacité par véhicule (colis), optionnelle.
 *
 * Simulation d'une tournée (fonction `simuler`) : on roule d'un point au
 * suivant ; si l'on arrive AVANT le début de la fenêtre on attend ; si l'on
 * arrive APRÈS la fin, on note le retard ; puis on reste s secondes sur place.
 *
 * Objectif, comparé dans l'ORDRE LEXICOGRAPHIQUE (vecteur de coûts) :
 *   1. colis au-delà de la capacité (somme sur les véhicules),
 *   2. minutes de retard (somme sur les livraisons),
 *   3. dépassement du plafond d'arrêts (critère « même nombre d'arrêts »),
 *   4. critère de base : distance, ou Σ charge² (« charges équilibrées »).
 * Une solution qui respecte les contraintes bat donc toujours une solution plus
 * courte qui ne les respecte pas ; à contraintes égales, on minimise le reste.
 *
 * Méthode :
 *  - une tournée : plusieurs solutions initiales (ordre le plus court, tri par
 *    heure limite, tri par heure de début) puis recherche locale (Or-opt sur des
 *    segments de 1 à 3 arrêts, 2-opt, échange de deux arrêts) ;
 *  - plusieurs livreurs : la répartition sans contraintes (vrp.ts) sert de
 *    point de départ, puis on déplace (meilleure insertion) ou échange des
 *    livraisons entre livreurs tant que le vecteur de coûts diminue, et l'on
 *    réordonne chaque tournée.
 *
 * Module pur, sans réseau. Copie identique côté navigateur : client/src/lib/contraintes.ts.
 */
import { solveTour } from './tsp.js';
import { repartirTournees, type CritereVrp, type PointPlan } from './vrp.js';

export interface Fenetre {
  /** Début (secondes depuis minuit) ou null. */
  debut: number | null;
  /** Fin (secondes depuis minuit) ou null. */
  fin: number | null;
}

export interface Contraintes {
  /** Durées de trajet (s), même indexation que la matrice des distances. */
  durees: number[][];
  /** Heure de départ du dépôt (s depuis minuit). */
  heureDepart: number;
  /** Temps passé à chaque livraison (s). */
  service: number;
  /** Fenêtre de chaque point (null = pas de contrainte). */
  fenetres: (Fenetre | null)[];
  /** Colis à livrer à chaque point (0 pour le dépôt / l'arrivée). */
  demandes: number[];
  /** Colis transportables par véhicule (null = illimité). */
  capacite: number | null;
}

export interface Passage {
  /** Indice du point dans la matrice. */
  noeud: number;
  /** Heure d'arrivée (s depuis minuit). */
  arrivee: number;
  /** Attente avant l'ouverture de la fenêtre (s). */
  attente: number;
  /** Retard après la fin de la fenêtre (s). */
  retard: number;
}

export interface Simulation {
  /** Un passage par livraison, dans l'ordre de la tournée. */
  passages: Passage[];
  /** Heure d'arrivée au point final (retour au dépôt ou arrivée). */
  heureFin: number;
  /** Somme des retards (s). */
  retardTotal: number;
  /** Nombre de livraisons en retard. */
  nombreRetards: number;
  /** Colis transportés. */
  charge: number;
  /** Temps de conduite (s). */
  conduite: number;
}

const EPS = 1e-9;
/**
 * Vitesse moyenne estimée sans OSRM, selon la longueur du trajet : 25 km/h en
 * ville (moins de 3 km), jusqu'à 65 km/h sur route entre deux villes (40 km et
 * plus), linéaire entre les deux. La durée reste croissante avec la distance.
 */
export function vitesseRepli(metres: number): number {
  const t = Math.min(1, Math.max(0, (metres - 3000) / 37000));
  return (25 + 40 * t) / 3.6; // m/s
}

/** Durées estimées depuis des distances (repli vol d'oiseau). */
export const dureesDepuisDistances = (D: number[][]) => D.map((l) => l.map((d) => (d > 0 ? d / vitesseRepli(d) : 0)));

/** Vrai si au moins une livraison a une fenêtre. */
export const aDesFenetres = (c: Contraintes) => c.fenetres.some((f) => f && (f.debut !== null || f.fin !== null));

/**
 * Simule la tournée `route` = [départ, livraison₁, …, livraisonₖ] qui se
 * termine au point `fin` (le départ pour une boucle, ou l'arrivée).
 */
export function simuler(route: number[], fin: number, c: Contraintes): Simulation {
  const T = c.durees;
  let t = c.heureDepart;
  let conduite = 0;
  let retardTotal = 0;
  let nombreRetards = 0;
  let charge = 0;
  const passages: Passage[] = [];
  for (let i = 1; i < route.length; i++) {
    const noeud = route[i];
    const trajet = T[route[i - 1]][noeud];
    conduite += trajet;
    t += trajet;
    const f = c.fenetres[noeud];
    let attente = 0;
    let retard = 0;
    if (f?.debut != null && t < f.debut) {
      attente = f.debut - t;
      t = f.debut;
    }
    if (f?.fin != null && t > f.fin + EPS) {
      retard = t - f.fin;
      retardTotal += retard;
      nombreRetards++;
    }
    passages.push({ noeud, arrivee: t - attente, attente, retard });
    t += c.service;
    charge += c.demandes[noeud] ?? 0;
  }
  const dernier = route[route.length - 1];
  conduite += T[dernier][fin];
  t += T[dernier][fin];
  return { passages, heureFin: t, retardTotal, nombreRetards, charge, conduite };
}

/** Distance d'une tournée ouverte qui finit en `fin`. */
function distanceRoute(D: number[][], route: number[], fin: number): number {
  let s = 0;
  for (let i = 1; i < route.length; i++) s += D[route[i - 1]][route[i]];
  return s + D[route[route.length - 1]][fin];
}

/** Comparaison lexicographique de deux vecteurs de coûts. */
export function meilleur(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i] - EPS) return true;
    if (a[i] > b[i] + EPS) return false;
  }
  return false;
}

/** Retard arrondi à la minute (évite de sacrifier des km pour quelques secondes). */
const minutesRetard = (s: number) => Math.round(s / 60);

/* ------------------------------------------------------------------ */
/* Une tournée                                                         */
/* ------------------------------------------------------------------ */

/** Coût d'une tournée seule : [minutes de retard, distance]. */
function coutRoute(D: number[][], route: number[], fin: number, c: Contraintes): number[] {
  return [minutesRetard(simuler(route, fin, c).retardTotal), distanceRoute(D, route, fin)];
}

/** Recherche locale sur l'ordre des livraisons (le départ reste en tête). */
function rechercheLocale(D: number[][], initiale: number[], fin: number, c: Contraintes): number[] {
  let route = initiale.slice();
  let cout = coutRoute(D, route, fin, c);
  const n = route.length;
  const essayer = (candidate: number[]) => {
    const k = coutRoute(D, candidate, fin, c);
    if (meilleur(k, cout)) {
      route = candidate;
      cout = k;
      return true;
    }
    return false;
  };
  let ameliore = true;
  let garde = 0;
  while (ameliore && garde++ < 200) {
    ameliore = false;
    // Or-opt : déplacer un segment de 1 à 3 livraisons.
    for (let len = 1; len <= 3 && !ameliore; len++) {
      for (let i = 1; i + len <= n && !ameliore; i++) {
        const segment = route.slice(i, i + len);
        const reste = [...route.slice(0, i), ...route.slice(i + len)];
        for (let j = 1; j <= reste.length && !ameliore; j++) {
          if (j === i) continue;
          ameliore = essayer([...reste.slice(0, j), ...segment, ...reste.slice(j)]);
        }
      }
    }
    // 2-opt : inverser un sous-segment.
    for (let i = 1; i < n - 1 && !ameliore; i++) {
      for (let j = i + 1; j < n && !ameliore; j++) {
        ameliore = essayer([...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)]);
      }
    }
    // Échange de deux livraisons.
    for (let i = 1; i < n - 1 && !ameliore; i++) {
      for (let j = i + 1; j < n && !ameliore; j++) {
        const r = route.slice();
        [r[i], r[j]] = [r[j], r[i]];
        ameliore = essayer(r);
      }
    }
  }
  return route;
}

/**
 * Ordonne les livraisons `arrets` d'une tournée qui part de `depart` et finit
 * en `fin` (= depart pour une boucle), en respectant au mieux les fenêtres.
 */
export function ordonnerAvecFenetres(
  D: number[][],
  depart: number,
  arrets: number[],
  fin: number,
  c: Contraintes,
): number[] {
  if (arrets.length === 0) return [depart];
  // Solution 1 : l'ordre le plus court (moteur TSP), sur la sous-matrice
  // départ + arrêts (+ arrivée distincte, forcée en dernier via un nœud fictif).
  const noeuds = [depart, ...arrets];
  let parDistance: number[];
  if (fin === depart) {
    const sous = noeuds.map((i) => noeuds.map((j) => D[i][j]));
    parDistance = solveTour(sous, 0).order.map((k) => noeuds[k]);
  } else {
    parDistance = [depart, ...plusProcheVoisin(D, depart, arrets)];
  }
  // Solutions 2 et 3 : tri par heure limite, puis par heure de début.
  const cle = (i: number, champ: 'debut' | 'fin') => c.fenetres[i]?.[champ] ?? Infinity;
  const parFin = [depart, ...arrets.slice().sort((a, b) => cle(a, 'fin') - cle(b, 'fin') || cle(a, 'debut') - cle(b, 'debut'))];
  const parDebut = [depart, ...arrets.slice().sort((a, b) => cle(a, 'debut') - cle(b, 'debut') || cle(a, 'fin') - cle(b, 'fin'))];

  let route = rechercheLocale(D, parDistance, fin, c);
  for (const initiale of [parFin, parDebut]) {
    const r = rechercheLocale(D, initiale, fin, c);
    if (meilleur(coutRoute(D, r, fin, c), coutRoute(D, route, fin, c))) route = r;
  }
  return route;
}

function plusProcheVoisin(D: number[][], depart: number, arrets: number[]): number[] {
  const restants = new Set(arrets);
  const ordre: number[] = [];
  let courant = depart;
  while (restants.size) {
    let choix = -1;
    for (const r of restants) if (choix < 0 || D[courant][r] < D[courant][choix]) choix = r;
    ordre.push(choix);
    restants.delete(choix);
    courant = choix;
  }
  return ordre;
}

/* ------------------------------------------------------------------ */
/* Plusieurs livreurs                                                  */
/* ------------------------------------------------------------------ */

export interface ResultatContraint {
  /** Tournées (départ en tête, boucle fermée), une par livreur. */
  tournees: number[][];
  distances: number[];
  total: number;
  simulations: Simulation[];
}

/**
 * Répartit et ordonne les livraisons entre `k` livreurs partant de `depot` et
 * y revenant, en respectant au mieux capacité et fenêtres horaires.
 */
export function repartirAvecContraintes(
  D: number[][],
  points: PointPlan[],
  depot: number,
  k: number,
  critere: CritereVrp,
  c: Contraintes,
): ResultatContraint {
  const n = D.length - 1;
  const plafond = Math.ceil(n / Math.max(1, Math.min(k, n)));
  // Point de départ : la répartition sans contraintes.
  const base = repartirTournees(D, points, depot, k, critere, { durees: c.durees, secondesParArret: c.service });
  let t = base.tournees.map((r) => ordonnerAvecFenetres(D, depot, r.slice(1), depot, c));

  const evaluer = (routes: number[][]) => {
    const sims = routes.map((r) => simuler(r, depot, c));
    const exces = c.capacite === null ? 0 : sims.reduce((s, x) => s + Math.max(0, x.charge - c.capacite!), 0);
    const retard = sims.reduce((s, x) => s + minutesRetard(x.retardTotal), 0);
    const arrets = routes.map((r) => r.length - 1);
    const depassement = critere === 'arrets' ? arrets.reduce((s, a) => s + Math.max(0, a - plafond), 0) : 0;
    const critereBase =
      critere === 'arrets'
        ? routes.reduce((s, r) => s + distanceRoute(D, r, depot), 0)
        : sims.reduce((s, x, i) => s + ((x.conduite + c.service * arrets[i]) / 1000) ** 2, 0);
    return [exces, retard, depassement, critereBase];
  };

  /** Meilleure position d'insertion de p dans la tournée r (ordre conservé). */
  const inserer = (r: number[], p: number) => {
    let choix = r.concat(p);
    let cout = coutRoute(D, choix, depot, c);
    for (let j = 1; j < r.length; j++) {
      const cand = [...r.slice(0, j), p, ...r.slice(j)];
      const k2 = coutRoute(D, cand, depot, c);
      if (meilleur(k2, cout)) {
        choix = cand;
        cout = k2;
      }
    }
    return choix;
  };

  let cout = evaluer(t);
  for (let tour = 0; tour < 3; tour++) {
    let ameliore = true;
    let garde = 0;
    while (ameliore && garde++ < 300) {
      ameliore = false;
      // Relocate : une livraison passe d'un livreur à un autre.
      for (let a = 0; a < t.length && !ameliore; a++) {
        if (t[a].length - 1 <= 1) continue; // chacun garde au moins une livraison
        for (const p of t[a].slice(1)) {
          if (ameliore) break;
          for (let b = 0; b < t.length && !ameliore; b++) {
            if (b === a) continue;
            const cand = t.slice();
            cand[a] = t[a].filter((x) => x !== p);
            cand[b] = inserer(t[b], p);
            const k2 = evaluer(cand);
            if (meilleur(k2, cout)) {
              t = cand;
              cout = k2;
              ameliore = true;
            }
          }
        }
      }
      // Swap : deux livraisons échangent de livreur.
      for (let a = 0; a < t.length && !ameliore; a++) {
        for (let b = a + 1; b < t.length && !ameliore; b++) {
          for (const p of t[a].slice(1)) {
            if (ameliore) break;
            for (const q of t[b].slice(1)) {
              const cand = t.slice();
              cand[a] = inserer(t[a].filter((x) => x !== p), q);
              cand[b] = inserer(t[b].filter((x) => x !== q), p);
              const k2 = evaluer(cand);
              if (meilleur(k2, cout)) {
                t = cand;
                cout = k2;
                ameliore = true;
                break;
              }
            }
          }
        }
      }
    }
    // Réordonne chaque tournée avec la recherche locale complète.
    const reord = t.map((r) => ordonnerAvecFenetres(D, depot, r.slice(1), depot, c));
    const k2 = evaluer(reord);
    if (!meilleur(k2, cout)) break;
    t = reord;
    cout = k2;
  }

  const distances = t.map((r) => distanceRoute(D, r, depot));
  return {
    tournees: t,
    distances,
    total: distances.reduce((s, d) => s + d, 0),
    simulations: t.map((r) => simuler(r, depot, c)),
  };
}

/** "08:30" → secondes depuis minuit (null si vide ou invalide). */
export function heureEnSecondes(h: string | null | undefined): number | null {
  if (!h) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 3600 + mm * 60;
}
