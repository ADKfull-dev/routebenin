/**
 * traces — conversion des géométries OSRM ([lng, lat]) en tracés Leaflet
 * ([lat, lng]), avec repli en lignes droites quand OSRM n'a rien fourni.
 */
import type { Arret, ResultatOptimisation } from '../types';
import type { MarqueurCarte, TraceCarte } from '../components/MapView';
import { couleurLivreur } from './couleurs';

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

/* ---------- Mode multi-livreurs ---------- */

/** Marqueurs et tracés d'une répartition multi-livreurs (un tracé coloré par livreur). */
export function carteMultiLivreurs(
  resultat: ResultatOptimisation,
  livreurActif: number | null,
): { marqueurs: MarqueurCarte[]; traces: TraceCarte[] } {
  const livreurs = resultat.livreurs ?? [];
  const depart = resultat.etapes[0]?.arret;
  const marqueurs: MarqueurCarte[] = [];
  if (depart) {
    marqueurs.push({ id: `depot-${depart.id}`, lat: depart.lat, lng: depart.lng, label: depart.label, type: 'depart' });
  }
  const traces: TraceCarte[] = [];
  livreurs.forEach((l, li) => {
    const couleur = couleurLivreur(li);
    const attenue = livreurActif !== null && livreurActif !== li;
    l.etapes.slice(1).forEach((e, idx) =>
      marqueurs.push({
        id: `l${li}-${e.arret.id}-${idx}`,
        lat: e.arret.lat,
        lng: e.arret.lng,
        label: `Livreur ${li + 1} · ${idx + 1}. ${e.arret.label}`,
        numero: idx + 1,
        type: 'etape',
        couleur,
        attenue,
      }),
    );
    traces.push({ positions: traceOptimise(l, true), couleur, attenue });
  });
  return { marqueurs, traces };
}
