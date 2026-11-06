/**
 * traces — conversion des géométries OSRM ([lng, lat]) en tracés Leaflet
 * ([lat, lng]), avec repli en lignes droites quand OSRM n'a rien fourni.
 */
import type { Arret, ResultatOptimisation } from '../types';

export type Trace = [number, number][];

const memeLieu = (a: Arret, b: Arret) =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

const versLeaflet = (g: [number, number][]): Trace => g.map(([lng, lat]) => [lat, lng]);
const relier = (pts: Arret[]): Trace => pts.map((a) => [a.lat, a.lng]);

/** Tracé de l'ordre de saisie (tournée « naïve »), pour la comparaison avant/après. */
export function traceInitial(
  resultat: ResultatOptimisation,
  depart: Arret,
  destinations: Arret[],
  arrivee: Arret | null,
): Trace {
  if (resultat.geometrieInitiale && resultat.geometrieInitiale.length > 1) {
    return versLeaflet(resultat.geometrieInitiale);
  }
  const fin = arrivee && !memeLieu(arrivee, depart) ? arrivee : depart;
  return relier([depart, ...destinations, fin]);
}

/** Tracé de la tournée optimisée (retour au départ inclus en boucle fermée). */
export function traceOptimise(resultat: ResultatOptimisation, boucle: boolean): Trace {
  if (resultat.geometrie && resultat.geometrie.length > 1) return versLeaflet(resultat.geometrie);
  const pts = resultat.etapes.map((e) => e.arret);
  return relier(boucle && pts.length > 1 ? [...pts, pts[0]] : pts);
}
