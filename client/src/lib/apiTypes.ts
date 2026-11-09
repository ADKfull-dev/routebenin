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
  /** Heure de départ du dépôt « HH:MM » (défaut : 08:00). */
  heureDepart?: string | null;
  /** Colis transportables par livreur (null = illimité). */
  capaciteVehicule?: number | null;
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
  /** Mode navigateur : serveur OSRM auto-hébergé, essayé avant le serveur public. */
  serveurOsrm?: string | null;
}

export interface SauvegardePayload {
  nom: string;
  depart: Arret;
  arrivee: Arret | null;
  destinations: Arret[];
  resultat: ResultatOptimisation;
}

/** Mode comptes (serveur avec COMPTES=oui). */
export interface UtilisateurSession {
  id: string;
  nom: string;
  email: string;
  role: 'admin' | 'membre';
}

export interface EtatSession {
  /** false : application mono-utilisateur (pas de connexion). */
  comptes: boolean;
  inscriptionsOuvertes: boolean;
  utilisateur: UtilisateurSession | null;
  entreprise: { id: string; nom: string } | null;
}

export interface Membre extends UtilisateurSession {
  creeLe: string;
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

  // Comptes (le mode navigateur répond { comptes: false })
  etatSession(): Promise<EtatSession>;
  connexion(email: string, motDePasse: string): Promise<void>;
  inscription(d: { entreprise: string; nom: string; email: string; motDePasse: string }): Promise<void>;
  deconnexion(): Promise<void>;
  changerMotDePasse(actuel: string, nouveau: string): Promise<void>;
  listerEquipe(): Promise<Membre[]>;
  ajouterMembre(d: { nom: string; email: string; motDePasse: string; role: 'admin' | 'membre' }): Promise<Membre>;
  retirerMembre(id: string): Promise<void>;
}
