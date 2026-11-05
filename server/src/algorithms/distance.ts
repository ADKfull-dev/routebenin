/**
 * distance.ts — Fonctions pures de calcul de distances géographiques.
 *
 * Ce module ne fait AUCUNE requête réseau. Il sert de repli (fallback)
 * lorsque le service OSRM est indisponible : on estime alors les distances
 * « à vol d'oiseau » (formule de Haversine).
 *
 * ⚠️ La distance à vol d'oiseau est une APPROXIMATION. En ville, la distance
 * routière réelle (fournie par OSRM) est toujours préférée. Voir osrm.ts.
 */

/** Rayon moyen de la Terre en mètres. */
const RAYON_TERRE_M = 6_371_000;

/** Un point géographique (latitude / longitude en degrés décimaux). */
export interface Coordonnee {
  lat: number;
  lng: number;
}

const enRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distance de Haversine entre deux coordonnées, en mètres.
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */
export function haversine(a: Coordonnee, b: Coordonnee): number {
  const dLat = enRadians(b.lat - a.lat);
  const dLng = enRadians(b.lng - a.lng);
  const lat1 = enRadians(a.lat);
  const lat2 = enRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Construit une matrice de distances N×N (en mètres) à partir d'une liste de
 * coordonnées, en utilisant Haversine. matrix[i][j] = distance de i vers j.
 * La diagonale vaut 0. La matrice est symétrique.
 */
export function matriceHaversine(points: Coordonnee[]): number[][] {
  const n = points.length;
  const matrice: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(points[i], points[j]);
      matrice[i][j] = d;
      matrice[j][i] = d;
    }
  }
  return matrice;
}
