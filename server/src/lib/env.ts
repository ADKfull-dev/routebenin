/**
 * Configuration centralisée, lue depuis les variables d'environnement.
 * Toute valeur configurable (ports, URLs des services) passe par ici.
 */

function lire(nom: string, defaut: string): string {
  const v = process.env[nom];
  return v && v.trim() !== '' ? v.trim() : defaut;
}

export const env = {
  /** Port d'écoute de l'API. */
  PORT: Number(lire('PORT', '3001')),

  /** Origine autorisée pour CORS (le frontend Vite en dev). */
  CLIENT_ORIGIN: lire('CLIENT_ORIGIN', 'http://localhost:5173'),

  /** URL du service OSRM (distances routières + itinéraires). */
  OSRM_URL: lire('OSRM_URL', 'https://router.project-osrm.org'),

  /**
   * Serveur OSRM de secours, essayé si le principal ne répond pas.
   * Mettre « aucun » pour désactiver.
   */
  OSRM_URL_SECOURS: (() => {
    const v = lire('OSRM_URL_SECOURS', 'https://router.project-osrm.org');
    return v === 'aucun' ? '' : v;
  })(),

  /** URL du service Nominatim (géocodage d'adresses). */
  NOMINATIM_URL: lire('NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),

  /**
   * User-Agent requis par la politique d'usage de Nominatim.
   * Renseignez un contact réel en production.
   */
  NOMINATIM_USER_AGENT: lire(
    'NOMINATIM_USER_AGENT',
    'RouteBenin/1.0 (projet de livraison; contact: exemple@routebenin.bj)',
  ),

  /**
   * Comptes et entreprises (« oui ») : connexion obligatoire, chaque entreprise
   * ne voit que ses tournées. « non » (défaut) : application mono-utilisateur.
   */
  COMPTES: lire('COMPTES', 'non') === 'oui',

  /** Mode comptes : création libre d'un compte entreprise (« ouvertes ») ou non. */
  INSCRIPTIONS_OUVERTES: lire('INSCRIPTIONS', 'ouvertes') !== 'fermees',

  /** Cookie de session réservé au https (à activer derrière un proxy https). */
  COOKIE_SECURISE: lire('COOKIE_SECURISE', 'non') === 'oui',

  /** Dossier de l'interface compilée à servir (production, même origine). Vide : API seule. */
  CLIENT_DIST: lire('CLIENT_DIST', ''),

  /** Pays privilégié pour le géocodage (codes ISO séparés par des virgules). */
  GEOCODE_COUNTRYCODES: lire('GEOCODE_COUNTRYCODES', 'bj'),
} as const;
