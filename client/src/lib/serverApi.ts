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
  type EtatSession,
  type Membre,
} from './apiTypes';

/** Émis quand le serveur répond 401 : la session a expiré (voir session.tsx). */
export const EVENEMENT_SESSION_EXPIREE = 'routebenin:session-expiree';

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
  if (reponse.status === 401 && !url.startsWith('/auth/')) {
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
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

  etatSession: () => requete<EtatSession>('/auth/etat'),
  connexion: (email, motDePasse) =>
    requete<unknown>('/auth/connexion', { method: 'POST', body: JSON.stringify({ email, motDePasse }) }).then(() => undefined),
  inscription: (d) => requete<unknown>('/auth/inscription', { method: 'POST', body: JSON.stringify(d) }).then(() => undefined),
  deconnexion: () => requete<void>('/auth/deconnexion', { method: 'POST' }),
  changerMotDePasse: (actuel, nouveau) =>
    requete<void>('/auth/mot-de-passe', { method: 'PUT', body: JSON.stringify({ actuel, nouveau }) }),
  listerEquipe: () => requete<{ membres: Membre[] }>('/equipe').then((r) => r.membres),
  ajouterMembre: (d) => requete<{ membre: Membre }>('/equipe', { method: 'POST', body: JSON.stringify(d) }).then((r) => r.membre),
  retirerMembre: (id) => requete<void>(`/equipe/${id}`, { method: 'DELETE' }),
};
