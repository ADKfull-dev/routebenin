/**
 * tsp.ts (version navigateur) — moteur d'optimisation identique à celui du
 * serveur (Plus Proche Voisin + 2-opt), utilisé pour le déploiement statique
 * (GitHub Pages) où aucun backend n'est disponible. Module pur, sans réseau.
 */

export interface ResultatTournee {
  order: number[];
  totalDistance: number;
}

export function computeTourDistance(matrix: number[][], order: number[]): number {
  if (order.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += matrix[order[i]][order[i + 1]];
  total += matrix[order[order.length - 1]][order[0]];
  return total;
}

function plusProcheVoisin(matrix: number[][], start: number): number[] {
  const n = matrix.length;
  const visite = new Array<boolean>(n).fill(false);
  const order = [start];
  visite[start] = true;
  let courant = start;
  for (let e = 1; e < n; e++) {
    let meilleur = -1;
    let d = Infinity;
    for (let c = 0; c < n; c++) {
      if (!visite[c] && matrix[courant][c] < d) {
        d = matrix[courant][c];
        meilleur = c;
      }
    }
    order.push(meilleur);
    visite[meilleur] = true;
    courant = meilleur;
  }
  return order;
}

function inverser(order: number[], i: number, j: number) {
  while (i < j) {
    [order[i], order[j]] = [order[j], order[i]];
    i++;
    j--;
  }
}

function deuxOpt(matrix: number[][], initial: number[]): number[] {
  const n = initial.length;
  if (n < 4) return initial.slice();
  const order = initial.slice();
  // Distances OSRM asymétriques : inverser [i..j] change aussi le coût des
  // arêtes intérieures (voir server/src/algorithms/tsp.ts).
  const symetrique = estSymetrique(matrix);
  const coutInversion = (i: number, j: number) => {
    let s = 0;
    for (let k = i; k < j; k++) s += matrix[order[k + 1]][order[k]] - matrix[order[k]][order[k + 1]];
    return s;
  };
  let ameliore = true;
  while (ameliore) {
    ameliore = false;
    for (let i = 1; i < n - 1; i++) {
      let interieur = 0;
      for (let j = i + 1; j < n; j++) {
        if (!symetrique) interieur += matrix[order[j]][order[j - 1]] - matrix[order[j - 1]][order[j]];
        const a = order[i - 1], b = order[i], c = order[j], d = order[(j + 1) % n];
        if (matrix[a][c] + matrix[b][d] + interieur + 1e-9 < matrix[a][b] + matrix[c][d]) {
          inverser(order, i, j);
          ameliore = true;
          if (!symetrique) interieur = coutInversion(i, j);
        }
      }
    }
  }
  return order;
}

function estSymetrique(matrix: number[][]): boolean {
  for (let i = 0; i < matrix.length; i++)
    for (let j = i + 1; j < matrix.length; j++)
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-9) return false;
  return true;
}

// Or-opt : déplace un point à une meilleure position (départ fixe). Renvoie
// true si une amélioration a été appliquée.
function orOpt(matrix: number[][], order: number[]): boolean {
  const n = order.length;
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
        order.splice(i, 1);
        order.splice(j > i ? j : j + 1, 0, ville);
        return true;
      }
    }
  }
  return false;
}

export function solveTour(matrix: number[][], start = 0): ResultatTournee {
  const n = matrix.length;
  if (n === 0) throw new Error('Matrice vide.');
  if (n === 1) return { order: [start], totalDistance: 0 };
  if (n === 2) {
    const autre = start === 0 ? 1 : 0;
    const order = [start, autre];
    return { order, totalDistance: computeTourDistance(matrix, order) };
  }
  let ordre = plusProcheVoisin(matrix, start);
  let continuer = true;
  let garde = 0;
  while (continuer && garde++ < 10_000) {
    ordre = deuxOpt(matrix, ordre);
    continuer = orOpt(matrix, ordre);
  }
  return { order: ordre, totalDistance: computeTourDistance(matrix, ordre) };
}

/* ---- Distances à vol d'oiseau (repli si OSRM indisponible) ---- */

export interface Coordonnee {
  lat: number;
  lng: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: Coordonnee, b: Coordonnee): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function matriceHaversine(points: Coordonnee[]): number[][] {
  const n = points.length;
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = haversine(points[i], points[j]);
      m[i][j] = d;
      m[j][i] = d;
    }
  return m;
}
