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
  /** Créneau de livraison « HH:MM » (début et/ou fin), optionnel. */
  fenetre?: { debut: string | null; fin: string | null } | null;
  /** Nombre de colis à livrer (1 par défaut). */
  colis?: number;
}

/** Horaires simulés d'une tournée (heures en secondes depuis minuit). */
export interface Horaires {
  heureDepart: number;
  /** Arrivée au point final (retour au dépôt ou arrivée). */
  heureFin: number;
  /** Un passage par livraison, dans l'ordre des étapes (départ et arrivée exclus). */
  passages: { arrivee: number; attente: number; retard: number }[];
  retards: number;
  retardTotal: number;
  attenteTotale: number;
  /** Colis transportés et capacité du véhicule. */
  charge: number;
  capacite: number | null;
  /** Au moins une livraison a un créneau. */
  avecFenetres: boolean;
  /** Durées estimées à 25 km/h (pas de durées OSRM). */
  estime: boolean;
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
  /** Mode multi-livreurs : une sous-tournée par livreur (dépôt en tête, boucle fermée). */
  livreurs?: ResultatOptimisation[] | null;
  /** Critère de répartition : charges équilibrées ou même nombre d'arrêts. */
  critereLivreurs?: CritereLivreurs | null;
  /** Temps sur place par livraison utilisé pour la durée totale (minutes ; 5 si absent). */
  minutesParLivraison?: number | null;
  /** Horaires estimés (tournée unique, ou chaque livreur). */
  horaires?: Horaires | null;
}

export type CritereLivreurs = 'equilibre' | 'arrets';

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
