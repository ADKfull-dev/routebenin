/**
 * serverApi — client HTTP vers le backend Express (mode full-stack).
 * Toutes les requêtes passent par /api (proxy Vite en développement).
 */
import type { ResultatGeocodage, ResultatOptimisation, TourneeSauvegardee } from '../types';
import {
  ApiError,
  type ApiClient,
  type EntreeOptimisation,
  type Profil,
  type ResumeTournee,
  type SauvegardePayload,
  type StatsDashboard,
} from './apiTypes';

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
    /* pas de corps JSON */
  }
  if (!reponse.ok) {
    throw new ApiError((data as { erreur?: string })?.erreur ?? 'Une erreur est survenue.');
  }
  return data as T;
}

export const serverApi: ApiClient = {
  geocoder: (q) =>
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

  obtenirTournee: (id) =>
    requete<{ tournee: TourneeSauvegardee }>(`/tournees/${id}`).then((r) => r.tournee),

  sauvegarderTournee: (payload: SauvegardePayload) =>
    requete<{ id: string }>('/tournees', { method: 'POST', body: JSON.stringify(payload) }),

  supprimerTournee: (id) => requete<void>(`/tournees/${id}`, { method: 'DELETE' }),

  obtenirProfil: () => requete<{ profil: Profil }>('/profil').then((r) => r.profil),

  mettreAJourProfil: (payload) =>
    requete<{ profil: Profil }>('/profil', { method: 'PUT', body: JSON.stringify(payload) }).then(
      (r) => r.profil,
    ),
};
