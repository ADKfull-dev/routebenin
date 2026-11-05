/**
 * Données de démonstration — adresses réelles de Cotonou (et environs).
 *
 * Coordonnées saisies en dur pour que la démonstration fonctionne même sans
 * connexion au service de géocodage. Ce sont de vraies localités ; les
 * coordonnées sont approximatives (centre du quartier).
 *
 * ⚠️ Ce sont des données d'exemple pour tester l'application. Les distances et
 * gains calculés à partir d'elles sont réels (vraie optimisation), mais la
 * tournée elle-même est fictive.
 */
import type { Arret } from '../types';

let compteur = 0;
const arret = (label: string, lat: number, lng: number): Arret => ({
  id: `demo-${++compteur}`,
  label,
  lat,
  lng,
});

/** Point de départ suggéré de la tournée de démonstration. */
export const DEPART_DEMO: Arret = arret('Ganhi (centre-ville)', 6.3622, 2.4281);

/** Destinations de démonstration (quartiers de Cotonou et agglomération). */
export const DESTINATIONS_DEMO: Arret[] = [
  arret('Marché Dantokpa', 6.3722, 2.43),
  arret('Akpakpa', 6.362, 2.435),
  arret('Fidjrossè', 6.358, 2.355),
  arret('Cadjèhoun', 6.365, 2.39),
  arret('Aéroport de Cotonou', 6.3572, 2.3844),
  arret('Haie Vive', 6.363, 2.4),
  arret('Les Cocotiers', 6.37, 2.41),
  arret('Gbégamey', 6.375, 2.405),
  arret('Jéricho', 6.368, 2.395),
  arret('Vêdoko', 6.385, 2.385),
  arret('Sainte-Rita', 6.373, 2.415),
  arret('Place de l’Étoile Rouge', 6.376, 2.42),
  arret('Abomey-Calavi (centre)', 6.4489, 2.3556),
  arret('Porto-Novo (centre)', 6.4969, 2.6283),
];

/** Tournée de démonstration complète (départ + destinations). */
export const TOURNEE_DEMO = {
  depart: DEPART_DEMO,
  destinations: DESTINATIONS_DEMO,
  arrivee: null as Arret | null, // retour au départ par défaut
};
