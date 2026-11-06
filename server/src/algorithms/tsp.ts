/**
 * tsp.ts — Moteur d'optimisation de tournée (problème du voyageur de commerce).
 *
 * C'est le cœur technique de RouteBénin. Le module est VOLONTAIREMENT pur :
 * il reçoit une matrice de distances et renvoie un ordre de passage + la
 * distance totale. Il ne connaît ni le réseau, ni la carte, ni Express.
 *
 * Problème résolu : partant d'un point de départ, visiter tous les points
 * exactement une fois et revenir au départ, en minimisant la distance totale.
 * C'est un cycle hamiltonien de poids minimal → le TSP, NP-difficile.
 *
 * Stratégie (défendable devant un jury) :
 *   1. Construction gloutonne par « Plus Proche Voisin » (Nearest Neighbor).
 *   2. Amélioration locale par « 2-opt » (décroisement des segments), répétée
 *      jusqu'à ce qu'aucune amélioration ne soit trouvée.
 *
 * La combinaison Plus Proche Voisin + 2-opt donne d'excellents résultats en
 * pratique pour des tailles réalistes (quelques dizaines de points) tout en
 * restant rapide.
 */

export interface ResultatTournee {
  /** Ordre de visite (indices de la matrice). Commence par `start`. */
  order: number[];
  /** Distance totale du cycle (retour au départ inclus), même unité que la matrice. */
  totalDistance: number;
}

/** Erreur levée quand la matrice fournie est invalide. */
export class MatriceInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatriceInvalideError';
  }
}

/** Vérifie qu'une matrice est carrée et non vide. */
function validerMatrice(matrix: number[][]): void {
  const n = matrix.length;
  if (n === 0) throw new MatriceInvalideError('La matrice est vide.');
  for (let i = 0; i < n; i++) {
    if (matrix[i].length !== n) {
      throw new MatriceInvalideError(
        `La matrice doit être carrée (ligne ${i} de longueur ${matrix[i].length}, attendu ${n}).`,
      );
    }
  }
}

/**
 * Distance totale d'un cycle fermé décrit par `order`.
 * On additionne les arêtes consécutives puis l'arête de retour au départ.
 */
export function computeTourDistance(matrix: number[][], order: number[]): number {
  if (order.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += matrix[order[i]][order[i + 1]];
  }
  // Retour au point de départ pour fermer la boucle.
  total += matrix[order[order.length - 1]][order[0]];
  return total;
}

/**
 * Étape 1 — Construction par Plus Proche Voisin.
 * Depuis le départ, on va toujours vers le point non visité le plus proche.
 */
export function plusProcheVoisin(matrix: number[][], start: number): number[] {
  const n = matrix.length;
  const visite = new Array<boolean>(n).fill(false);
  const order: number[] = [start];
  visite[start] = true;

  let courant = start;
  for (let etape = 1; etape < n; etape++) {
    let meilleur = -1;
    let meilleureDist = Infinity;
    for (let candidat = 0; candidat < n; candidat++) {
      if (!visite[candidat] && matrix[courant][candidat] < meilleureDist) {
        meilleureDist = matrix[courant][candidat];
        meilleur = candidat;
      }
    }
    // meilleur est toujours trouvé car il reste des points non visités.
    order.push(meilleur);
    visite[meilleur] = true;
    courant = meilleur;
  }
  return order;
}

/**
 * Étape 2 — Amélioration locale par 2-opt.
 *
 * Principe : tant qu'il existe deux arêtes qui, une fois « décroisées »,
 * raccourcissent le tour, on inverse le segment concerné. On répète jusqu'à
 * stabilité (optimum local).
 *
 * Le point de départ (indice 0 de `order`) reste fixe : on ne réordonne que
 * les points intermédiaires, ce qui garantit que la tournée part toujours du
 * départ demandé.
 */
export function deuxOpt(matrix: number[][], ordreInitial: number[]): number[] {
  const n = ordreInitial.length;
  if (n < 4) return ordreInitial.slice(); // pas d'amélioration possible en dessous

  const order = ordreInitial.slice();
  let ameliore = true;

  while (ameliore) {
    ameliore = false;
    // i et j délimitent le segment [i..j] que l'on envisage d'inverser.
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = order[i - 1];
        const b = order[i];
        const c = order[j];
        // d = point qui suit j dans le cycle (retour au départ si j est le dernier)
        const d = order[(j + 1) % n];

        // Gain = (distance des arêtes actuelles) - (distance après inversion)
        const avant = matrix[a][b] + matrix[c][d];
        const apres = matrix[a][c] + matrix[b][d];

        if (apres + 1e-9 < avant) {
          inverserSegment(order, i, j);
          ameliore = true;
        }
      }
    }
  }
  return order;
}

/** Inverse en place le segment order[i..j] (bornes incluses). */
function inverserSegment(order: number[], i: number, j: number): void {
  while (i < j) {
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
    i++;
    j--;
  }
}

/**
 * Étape 2 bis — Or-opt : déplace un point à une meilleure position dans la
 * tournée (le départ, indice 0, reste fixe). Complète 2-opt : certaines
 * améliorations qu'un simple décroisement ne trouve pas sont capturées ici.
 * Renvoie true si une amélioration a été appliquée.
 */
export function orOpt(matrix: number[][], order: number[]): boolean {
  const n = order.length;
  let ameliore = false;
  for (let i = 1; i < n; i++) {
    const prev = order[(i - 1 + n) % n];
    const ville = order[i];
    const next = order[(i + 1) % n];
    const coutRetrait = matrix[prev][ville] + matrix[ville][next] - matrix[prev][next];
    for (let j = 1; j < n; j++) {
      if (j === i || j === i - 1) continue;
      const a = order[j];
      const b = order[(j + 1) % n];
      if (a === ville || b === ville) continue;
      const coutInsertion = matrix[a][ville] + matrix[ville][b] - matrix[a][b];
      if (coutInsertion + 1e-9 < coutRetrait) {
        // Déplace `ville` de la position i vers juste après la position j.
        order.splice(i, 1);
        const cible = j > i ? j : j + 1;
        order.splice(cible, 0, ville);
        return true; // un déplacement à la fois, puis on relance
      }
    }
  }
  return ameliore;
}

/**
 * Résout la tournée : Plus Proche Voisin puis amélioration 2-opt.
 *
 * @param matrix matrice carrée des distances (matrix[i][j] = i → j)
 * @param start  indice du point de départ (défaut 0)
 * @returns l'ordre de passage optimisé et la distance totale (retour inclus)
 */
export function solveTour(matrix: number[][], start = 0): ResultatTournee {
  validerMatrice(matrix);
  const n = matrix.length;
  if (start < 0 || start >= n) {
    throw new MatriceInvalideError(
      `Indice de départ invalide (${start}) pour ${n} point(s).`,
    );
  }

  // Cas limites : 1 ou 2 points → une seule tournée possible.
  if (n === 1) return { order: [start], totalDistance: 0 };
  if (n === 2) {
    const autre = start === 0 ? 1 : 0;
    const order = [start, autre];
    return { order, totalDistance: computeTourDistance(matrix, order) };
  }

  // Construction gloutonne, puis amélioration : on alterne 2-opt et Or-opt
  // jusqu'à ce qu'aucune des deux ne trouve plus d'amélioration.
  let ordre = plusProcheVoisin(matrix, start);
  let continuer = true;
  while (continuer) {
    ordre = deuxOpt(matrix, ordre);
    continuer = orOpt(matrix, ordre); // true si Or-opt a amélioré → on reboucle
  }
  return { order: ordre, totalDistance: computeTourDistance(matrix, ordre) };
}

/**
 * Résolution EXACTE par force brute (toutes les permutations).
 * Réservée aux tests et à la vérification d'optimalité sur de petits cas
 * (≤ ~9 points). À ne jamais utiliser en production : coût factoriel.
 */
export function solveTourBruteForce(matrix: number[][], start = 0): ResultatTournee {
  validerMatrice(matrix);
  const n = matrix.length;
  if (n <= 2) return solveTour(matrix, start);

  const autres = [];
  for (let i = 0; i < n; i++) if (i !== start) autres.push(i);

  let meilleurOrdre: number[] = [start, ...autres];
  let meilleureDist = Infinity;

  const permuter = (prefixe: number[], reste: number[]): void => {
    if (reste.length === 0) {
      const ordre = [start, ...prefixe];
      const d = computeTourDistance(matrix, ordre);
      if (d < meilleureDist) {
        meilleureDist = d;
        meilleurOrdre = ordre;
      }
      return;
    }
    for (let i = 0; i < reste.length; i++) {
      const suivant = reste[i];
      const nouveauReste = reste.slice(0, i).concat(reste.slice(i + 1));
      permuter([...prefixe, suivant], nouveauReste);
    }
  };

  permuter([], autres);
  return { order: meilleurOrdre, totalDistance: meilleureDist };
}
