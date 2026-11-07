/**
 * Types partagés entre les deux implémentations du client de données :
 *  - serverApi.ts : parle au backend Express (mode full-stack) ;
 *  - localApi.ts  : tout en navigateur (mode statique / GitHub Pages).
 */
import type { Arret, ResultatGeocodage, ResultatOptimisation, TourneeSauvegardee } from '../types';

/** Erreur portant un message déjà rédigé en français. */
export class ApiError extends Error {}

export interface EntreeOptimisation {
  depart: Arret;
  destinations: Arret[];
  arrivee: Arret | null;
  prefererOsrm?: boolean;
  /** Nombre de livreurs (1 à 6 ; 1 = tournée unique). */
  nombreLivreurs?: number;
  critereLivreurs?: 'equilibre' | 'arrets';
  /** Temps passé à chaque livraison, en minutes (défaut : 5). */
  minutesParLivraison?: number;
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
  /** Temps passé à chaque livraison, en minutes. */
  minutesParLivraison: number;
}

export interface SauvegardePayload {
  nom: string;
  depart: Arret;
  arrivee: Arret | null;
  destinations: Arret[];
  resultat: ResultatOptimisation;
}

/** Contrat commun aux deux implémentations. */
export interface ApiClient {
  geocoder(q: string): Promise<ResultatGeocodage[]>;
  optimiser(entree: EntreeOptimisation): Promise<ResultatOptimisation>;
  stats(): Promise<StatsDashboard>;
  listerTournees(): Promise<ResumeTournee[]>;
  obtenirTournee(id: string): Promise<TourneeSauvegardee>;
  sauvegarderTournee(payload: SauvegardePayload): Promise<{ id: string }>;
  supprimerTournee(id: string): Promise<void>;
  obtenirProfil(): Promise<Profil>;
  mettreAJourProfil(payload: Partial<Omit<Profil, 'id'>>): Promise<Profil>;
}
