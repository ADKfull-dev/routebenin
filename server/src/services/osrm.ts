/**
 * osrm.ts — Service OSRM (distances routières réelles + tracé d'itinéraire).
 *
 * Deux usages :
 *  - `matriceDistancesOSRM` : matrice des distances/durées entre tous les points
 *    (endpoint /table), utilisée par l'optimiseur.
 *  - `traceItineraire` : géométrie du parcours dans un ordre donné (endpoint
 *    /route), utilisée pour dessiner la tournée optimisée sur la carte.
 *
 * En cas d'indisponibilité, ces fonctions lèvent ServiceIndisponibleError ;
 * l'appelant décide alors de basculer sur un calcul à vol d'oiseau (Haversine).
 */
import { env } from '../lib/env.js';
import { ServiceIndisponibleError } from './nominatim.js';
import type { Coordonnee } from '../algorithms/distance.js';
import { matriceDepuisPack, traceDepuisPack } from './packDemo.js';

function coordsVersChaine(points: Coordonnee[]): string {
  // OSRM attend l'ordre lng,lat séparé par des points-virgules.
  return points.map((p) => `${p.lng},${p.lat}`).join(';');
}

async function appelOSRM<T>(url: URL): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ServiceIndisponibleError('Le service de calcul d’itinéraire (OSRM) est injoignable.');
  }
  if (!reponse.ok) {
    throw new ServiceIndisponibleError(
      `Le service OSRM a répondu avec une erreur (${reponse.status}).`,
    );
  }
  const data = (await reponse.json()) as T & { code?: string };
  if (data.code && data.code !== 'Ok') {
    throw new ServiceIndisponibleError(`OSRM a refusé la requête (${data.code}).`);
  }
  return data;
}

interface ReponseTable {
  code: string;
  distances: number[][]; // mètres
  durations: number[][]; // secondes
}

/** Matrice des distances (mètres) et durées (secondes) routières entre tous les points. */
export async function matriceDistancesOSRM(
  points: Coordonnee[],
): Promise<{ distances: number[][]; durations: number[][] }> {
  const pack = matriceDepuisPack(points); // exemple de démo : données OSRM pré-calculées
  if (pack) return pack;
  const url = new URL(
    `/table/v1/driving/${coordsVersChaine(points)}`,
    env.OSRM_URL,
  );
  url.searchParams.set('annotations', 'distance,duration');
  const data = await appelOSRM<ReponseTable>(url);
  if (!data.distances || !data.durations) {
    throw new ServiceIndisponibleError('Réponse OSRM incomplète (matrice manquante).');
  }
  return { distances: data.distances, durations: data.durations };
}

interface ReponseRoute {
  code: string;
  routes: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

/**
 * Trace l'itinéraire routier passant par `pointsOrdonnes` dans l'ordre fourni.
 * @returns géométrie [ [lng,lat], ... ], distance (m) et durée (s).
 */
export async function traceItineraire(points: Coordonnee[]): Promise<{
  geometrie: [number, number][];
  distance: number;
  duree: number;
}> {
  const pack = traceDepuisPack(points);
  if (pack) return pack;
  const url = new URL(
    `/route/v1/driving/${coordsVersChaine(points)}`,
    env.OSRM_URL,
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  const data = await appelOSRM<ReponseRoute>(url);
  const route = data.routes?.[0];
  if (!route) {
    throw new ServiceIndisponibleError('OSRM n’a renvoyé aucun itinéraire.');
  }
  return {
    geometrie: route.geometry.coordinates,
    distance: route.distance,
    duree: route.duration,
  };
}
