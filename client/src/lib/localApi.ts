/**
 * localApi — implémentation 100 % navigateur (mode statique / GitHub Pages).
 *
 * Aucun backend : le géocodage et les distances routières sont demandés
 * directement à Nominatim et OSRM (qui autorisent le CORS), l'optimisation
 * tourne dans le navigateur (tsp.ts) et l'historique/profil sont stockés dans
 * localStorage. Les fonctionnalités visibles sont donc toutes opérationnelles.
 */
import type { Arret, ResultatGeocodage, ResultatOptimisation, TourneeSauvegardee } from '../types';
import {
  ApiError,
  type ApiClient,
  type EntreeOptimisation,
  type Profil,
  type ResumeTournee,
  type SauvegardePayload,
  type StatsDashboard,
} from './apiTypes';
import { solveTour, computeTourDistance, matriceHaversine, type Coordonnee } from './tsp';
import { repartirTournees, repartitionNaive, type CritereVrp } from './vrp';
import { matriceDepuisPack, traceDepuisPack } from './packDemo';

const OSRM = 'https://router.project-osrm.org';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const CLE_TOURNEES = 'routebenin.tournees';
const CLE_PROFIL = 'routebenin.profil';

/* ---------- Stockage local ---------- */
function lireTournees(): TourneeSauvegardee[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_TOURNEES) ?? '[]') as TourneeSauvegardee[];
  } catch {
    return [];
  }
}
function ecrireTournees(t: TourneeSauvegardee[]): void {
  try {
    localStorage.setItem(CLE_TOURNEES, JSON.stringify(t));
  } catch {
    /* quota / mode privé : on ignore silencieusement */
  }
}
function lireProfil(): Profil {
  const defaut: Profil = { id: 'profil', nomUtilisateur: null, nomEntreprise: null, ville: null, prefererOsrm: true, minutesParLivraison: 5 };
  try {
    const p = localStorage.getItem(CLE_PROFIL);
    return p ? { ...defaut, ...(JSON.parse(p) as Partial<Profil>) } : defaut;
  } catch {
    return defaut;
  }
}

/* ---------- Services géographiques (navigateur) ---------- */
const coordsChaine = (p: Coordonnee[]) => p.map((c) => `${c.lng},${c.lat}`).join(';');

async function osrmTable(points: Coordonnee[]) {
  const pack = await matriceDepuisPack(points); // exemple de démo : données OSRM pré-calculées
  if (pack) return pack;
  const url = `${OSRM}/table/v1/driving/${coordsChaine(points)}?annotations=distance,duration`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('osrm');
  const d = (await r.json()) as { code: string; distances: number[][]; durations: number[][] };
  if (d.code !== 'Ok' || !d.distances) throw new Error('osrm');
  return { distances: d.distances, durations: d.durations };
}

async function osrmRoute(points: Coordonnee[]) {
  const pack = await traceDepuisPack(points);
  if (pack) return pack;
  const url = `${OSRM}/route/v1/driving/${coordsChaine(points)}?overview=full&geometries=geojson`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('osrm');
  const d = (await r.json()) as { code: string; routes: { geometry: { coordinates: [number, number][] } }[] };
  if (d.code !== 'Ok' || !d.routes?.[0]) throw new Error('osrm');
  return d.routes[0].geometry.coordinates;
}

const memeLieu = (a: Arret, b: Arret) =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

function distanceChemin(matrix: number[][], ordre: number[]): number {
  let total = 0;
  for (let i = 0; i < ordre.length - 1; i++) total += matrix[ordre[i]][ordre[i + 1]];
  return total;
}

/* ---------- Multi-livreurs (VRP) — miroir de server/src/services/optimisation.ts ---------- */
async function optimiserMultiLivreurs(
  noeuds: Arret[],
  distances: number[][],
  durations: number[][] | null,
  source: 'osrm' | 'haversine',
  k: number,
  critere: CritereVrp,
  secondesParArret: number,
): Promise<ResultatOptimisation> {
  const vrp = repartirTournees(distances, noeuds.map((a) => ({ lat: a.lat, lng: a.lng })), 0, k, critere, {
    durees: durations,
    secondesParArret,
  });
  const distanceInitiale = repartitionNaive(distances, 0, k);
  const geometries = await Promise.all(
    vrp.tournees.map((t) =>
      source === 'osrm'
        ? osrmRoute([...t, 0].map((i) => ({ lat: noeuds[i].lat, lng: noeuds[i].lng }))).catch(() => null)
        : Promise.resolve(null),
    ),
  );
  const livreurs: ResultatOptimisation[] = vrp.tournees.map((t, idx) => {
    let duree: number | null = null;
    if (durations) {
      duree = 0;
      for (let i = 0; i < t.length; i++) duree += durations[t[i]][t[(i + 1) % t.length]];
    }
    return {
      etapes: t.map((i, position) => ({ position, arret: noeuds[i] })),
      distanceInitiale: vrp.distances[idx],
      distanceOptimisee: vrp.distances[idx],
      gainMetres: 0,
      gainPourcent: 0,
      dureeSecondes: duree,
      nombreDestinations: t.length - 1,
      source,
      geometrie: geometries[idx],
      geometrieInitiale: null,
    };
  });
  const gainMetres = Math.max(0, distanceInitiale - vrp.total);
  const durees = livreurs.map((l) => l.dureeSecondes);
  return {
    etapes: [noeuds[0], ...vrp.tournees.flatMap((t) => t.slice(1).map((i) => noeuds[i]))].map(
      (arret, position) => ({ position, arret }),
    ),
    distanceInitiale,
    distanceOptimisee: vrp.total,
    gainMetres,
    gainPourcent: distanceInitiale > 0 ? (gainMetres / distanceInitiale) * 100 : 0,
    dureeSecondes: durees.every((d) => d !== null) ? Math.max(...(durees as number[])) : null,
    nombreDestinations: noeuds.length - 1,
    source,
    geometrie: null,
    geometrieInitiale: null,
    livreurs,
    critereLivreurs: critere,
  };
}

/* ---------- Tournée unique ou multi-livreurs ---------- */
async function calculerTournee(entree: EntreeOptimisation, secondesParArret: number): Promise<ResultatOptimisation> {
  const { depart, destinations, arrivee, prefererOsrm = true } = entree;
  if (!destinations || destinations.length < 1) {
    throw new ApiError('Ajoutez au moins une destination à votre tournée.');
  }

  const arriveeDistincte = arrivee !== null && !memeLieu(arrivee, depart);
  const noeuds: Arret[] = arriveeDistincte ? [depart, ...destinations, arrivee] : [depart, ...destinations];
  const coords: Coordonnee[] = noeuds.map((a) => ({ lat: a.lat, lng: a.lng }));

  // Matrice : OSRM si possible, sinon Haversine.
  let distances: number[][];
  let durations: number[][] | null = null;
  let source: 'osrm' | 'haversine' = 'haversine';
  if (prefererOsrm) {
    try {
      const t = await osrmTable(coords);
      distances = t.distances;
      durations = t.durations;
      source = 'osrm';
    } catch {
      distances = matriceHaversine(coords);
    }
  } else {
    distances = matriceHaversine(coords);
  }

  const nombreLivreurs = Math.min(entree.nombreLivreurs ?? 1, destinations.length);
  if (nombreLivreurs > 1) {
    if (arriveeDistincte) {
      throw new ApiError('En mode multi-livreurs, chaque livreur revient au point de départ : retirez l’arrivée.');
    }
    return optimiserMultiLivreurs(noeuds, distances, durations, source, nombreLivreurs, entree.critereLivreurs ?? 'equilibre', secondesParArret);
  }

  const n = noeuds.length;
  let ordreOptimise: number[];
  let distanceOptimisee: number;
  let distanceInitiale: number;
  let noeudsItineraire: Arret[];

  if (!arriveeDistincte) {
    const ordreSaisie = noeuds.map((_, i) => i);
    distanceInitiale = computeTourDistance(distances, ordreSaisie);
    const res = solveTour(distances, 0);
    ordreOptimise = res.order;
    distanceOptimisee = res.totalDistance;
    noeudsItineraire = [...ordreOptimise.map((i) => noeuds[i]), noeuds[ordreOptimise[0]]];
  } else {
    const depIdx = 0;
    const finIdx = n - 1;
    const fictif = n;
    let somme = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) somme += distances[i][j];
    const BIG = somme + 1;
    const aug = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) aug[i][j] = distances[i][j];
    for (let k = 0; k <= n; k++) {
      const cout = k === depIdx || k === finIdx ? 0 : BIG;
      aug[fictif][k] = cout;
      aug[k][fictif] = cout;
    }
    const res = solveTour(aug, depIdx);
    const cycle = res.order;
    const p = cycle.indexOf(fictif);
    const tourne = [...cycle.slice(p), ...cycle.slice(0, p)];
    let chemin = tourne.slice(1);
    if (chemin[0] !== depIdx) chemin = chemin.slice().reverse();
    ordreOptimise = chemin;
    distanceOptimisee = distanceChemin(distances, chemin);
    distanceInitiale = distanceChemin(distances, noeuds.map((_, i) => i));
    noeudsItineraire = ordreOptimise.map((i) => noeuds[i]);
  }

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

  const gainMetres = Math.max(0, distanceInitiale - distanceOptimisee);
  const gainPourcent = distanceInitiale > 0 ? (gainMetres / distanceInitiale) * 100 : 0;

  // Tracés routiers : ordre optimisé + ordre de saisie (comparaison avant/après).
  const noeudsInitiaux = arriveeDistincte ? noeuds : [...noeuds, depart];
  const tracer = (pts: Arret[]) =>
    osrmRoute(pts.map((a) => ({ lat: a.lat, lng: a.lng }))).catch(() => null);
  const [geometrie, geometrieInitiale] =
    source === 'osrm'
      ? await Promise.all([tracer(noeudsItineraire), tracer(noeudsInitiaux)])
      : [null, null];

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
    geometrieInitiale,
  };
}

/* ---------- Implémentation ---------- */
export const localApi: ApiClient = {
  async geocoder(q: string): Promise<ResultatGeocodage[]> {
    if (q.trim().length < 3) return [];
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&countrycodes=bj`;
    let r: Response;
    try {
      r = await fetch(url, { headers: { 'Accept-Language': 'fr' }, signal: AbortSignal.timeout(10000) });
    } catch {
      throw new ApiError('Service de géocodage injoignable. Vérifiez votre connexion.');
    }
    if (!r.ok) throw new ApiError('Le service de géocodage a renvoyé une erreur.');
    const data = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    return data.map((x) => ({ label: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
  },

  async optimiser(entree: EntreeOptimisation): Promise<ResultatOptimisation> {
    const minutesParLivraison = entree.minutesParLivraison ?? 5;
    const r = await calculerTournee(entree, minutesParLivraison * 60);
    return { ...r, minutesParLivraison };
  },

  async stats(): Promise<StatsDashboard> {
    const t = lireTournees().sort((a, b) => b.creeLe.localeCompare(a.creeLe));
    const distanceTotale = t.reduce((s, x) => s + x.resultat.distanceOptimisee, 0);
    const gainTotal = t.reduce((s, x) => s + x.resultat.gainMetres, 0);
    const tauxMoyen = t.length ? t.reduce((s, x) => s + x.resultat.gainPourcent, 0) / t.length : 0;
    return {
      nombreTournees: t.length,
      distanceTotale,
      gainTotal,
      tauxMoyenOptimisation: tauxMoyen,
      dernieres: t.slice(0, 5).map((x) => ({
        id: x.id,
        nom: x.nom,
        creeLe: x.creeLe,
        nombreDestinations: x.resultat.nombreDestinations,
        distanceOptimisee: x.resultat.distanceOptimisee,
        gainPourcent: x.resultat.gainPourcent,
      })),
    };
  },

  async listerTournees(): Promise<ResumeTournee[]> {
    return lireTournees()
      .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
      .map((x) => ({
        id: x.id,
        nom: x.nom,
        creeLe: x.creeLe,
        nombreDestinations: x.resultat.nombreDestinations,
        distanceOptimisee: x.resultat.distanceOptimisee,
        gainMetres: x.resultat.gainMetres,
        gainPourcent: x.resultat.gainPourcent,
        source: x.resultat.source,
      }));
  },

  async obtenirTournee(id: string): Promise<TourneeSauvegardee> {
    const t = lireTournees().find((x) => x.id === id);
    if (!t) throw new ApiError('Tournée introuvable.');
    return t;
  },

  async sauvegarderTournee(payload: SauvegardePayload): Promise<{ id: string }> {
    const nom = payload.nom.trim();
    if (!nom) throw new ApiError('Donnez un nom à la tournée.');
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t = lireTournees();
    t.push({
      id,
      nom,
      creeLe: new Date().toISOString(),
      depart: payload.depart,
      arrivee: payload.arrivee,
      destinations: payload.destinations,
      resultat: payload.resultat,
    });
    ecrireTournees(t);
    return { id };
  },

  async supprimerTournee(id: string): Promise<void> {
    ecrireTournees(lireTournees().filter((x) => x.id !== id));
  },

  async obtenirProfil(): Promise<Profil> {
    return lireProfil();
  },

  async mettreAJourProfil(payload: Partial<Omit<Profil, 'id'>>): Promise<Profil> {
    const maj = { ...lireProfil(), ...payload, id: 'profil' };
    try {
      localStorage.setItem(CLE_PROFIL, JSON.stringify(maj));
    } catch {
      /* ignore */
    }
    return maj;
  },
};
