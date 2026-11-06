/**
 * Types partagés du frontend RouteBénin.
 * (Le backend possède ses propres types ; les formes JSON échangées sont
 *  volontairement identiques pour éviter toute ambiguïté.)
 */

/** Un arrêt de la tournée : un point géographique nommé. */
export interface Arret {
  id: string;
  /** Libellé lisible (adresse ou nom de lieu). */
  label: string;
  lat: number;
  lng: number;
}

/** Résultat renvoyé par un géocodage (recherche d'adresse). */
export interface ResultatGeocodage {
  label: string;
  lat: number;
  lng: number;
}

/** Source de la matrice de distances utilisée pour l'optimisation. */
export type SourceDistance = 'osrm' | 'haversine';

/** Une étape de la tournée optimisée, prête à l'affichage. */
export interface EtapeOptimisee {
  /** Position dans l'ordre optimisé (0 = départ). */
  position: number;
  arret: Arret;
}

/** Réponse complète de l'optimisation d'une tournée. */
export interface ResultatOptimisation {
  /** Arrêts réordonnés selon la tournée optimale (départ en tête). */
  etapes: EtapeOptimisee[];
  /** Distance de la tournée dans l'ordre de saisie (mètres). */
  distanceInitiale: number;
  /** Distance de la tournée optimisée (mètres). */
  distanceOptimisee: number;
  /** Mètres économisés (initiale - optimisée, jamais négatif). */
  gainMetres: number;
  /** Pourcentage de réduction (0..100). */
  gainPourcent: number;
  /** Durée estimée de la tournée optimisée en secondes (null si indisponible). */
  dureeSecondes: number | null;
  /** Nombre de destinations (hors départ). */
  nombreDestinations: number;
  /** D'où viennent les distances : routières (OSRM) ou à vol d'oiseau. */
  source: SourceDistance;
  /** Géométrie du tracé optimisé [ [lng,lat], ... ] si fournie par OSRM. */
  geometrie: [number, number][] | null;
  /** Géométrie du tracé dans l'ordre de saisie (absente des anciennes tournées). */
  geometrieInitiale?: [number, number][] | null;
}

/** Une tournée sauvegardée (historique). */
export interface TourneeSauvegardee {
  id: string;
  nom: string;
  creeLe: string; // ISO date
  depart: Arret;
  arrivee: Arret | null;
  destinations: Arret[];
  resultat: ResultatOptimisation;
}
