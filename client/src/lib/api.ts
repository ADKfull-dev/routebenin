/**
 * Client HTTP vers l'API RouteBénin.
 * Toutes les requêtes passent par /api (proxy Vite en dev).
 */
import type {
  Arret,
  ResultatGeocodage,
  ResultatOptimisation,
  TourneeSauvegardee,
} from '../types';

/** Erreur portant le message renvoyé par l'API (déjà en français). */
export class ApiError extends Error {}

async function requete<T>(url: string, options?: RequestInit): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`/api${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Serveur injoignable. Vérifiez que l’API est démarrée.');
  }

  if (reponse.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await reponse.json();
  } catch {
    /* réponse sans corps JSON */
  }

  if (!reponse.ok) {
    const message =
      (data as { erreur?: string })?.erreur ?? 'Une erreur est survenue.';
    throw new ApiError(message);
  }
  return data as T;
}

export interface EntreeOptimisation {
  depart: Arret;
  destinations: Arret[];
  arrivee: Arret | null;
  prefererOsrm?: boolean;
}

export interface StatsDashboard {
  nombreTournees: number;
  distanceTotale: number;
  gainTotal: number;
  tauxMoyenOptimisation: number;
  dernieres: {
    id: string;
    nom: string;
    creeLe: string;
    nombreDestinations: number;
    distanceOptimisee: number;
    gainPourcent: number;
  }[];
}

export interface ResumeTournee {
  id: string;
  nom: string;
  creeLe: string;
  nombreDestinations: number;
  distanceOptimisee: number;
  gainMetres: number;
  gainPourcent: number;
  source: string;
}

export interface Profil {
  id: string;
  nomUtilisateur: string | null;
  nomEntreprise: string | null;
  ville: string | null;
  prefererOsrm: boolean;
}

export const api = {
  geocoder: (q: string) =>
    requete<{ resultats: ResultatGeocodage[] }>(
      `/geocode?q=${encodeURIComponent(q)}`,
    ).then((r) => r.resultats),

  optimiser: (entree: EntreeOptimisation) =>
    requete<{ resultat: ResultatOptimisation }>('/optimize', {
      method: 'POST',
      body: JSON.stringify(entree),
    }).then((r) => r.resultat),

  stats: () => requete<StatsDashboard>('/stats'),

  listerTournees: () =>
    requete<{ tournees: ResumeTournee[] }>('/tournees').then((r) => r.tournees),

  obtenirTournee: (id: string) =>
    requete<{ tournee: TourneeSauvegardee }>(`/tournees/${id}`).then(
      (r) => r.tournee,
    ),

  sauvegarderTournee: (payload: {
    nom: string;
    depart: Arret;
    arrivee: Arret | null;
    destinations: Arret[];
    resultat: ResultatOptimisation;
  }) =>
    requete<{ id: string }>('/tournees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  supprimerTournee: (id: string) =>
    requete<void>(`/tournees/${id}`, { method: 'DELETE' }),

  obtenirProfil: () => requete<{ profil: Profil }>('/profil').then((r) => r.profil),

  mettreAJourProfil: (payload: Partial<Omit<Profil, 'id'>>) =>
    requete<{ profil: Profil }>('/profil', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then((r) => r.profil),
};
