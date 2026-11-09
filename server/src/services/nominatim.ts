/**
 * nominatim.ts — Service de géocodage (adresse → coordonnées) via Nominatim.
 *
 * Respecte la politique d'usage de Nominatim :
 *  - 1 requête par seconde maximum (LimiteurDebit) ;
 *  - User-Agent identifiant l'application (env.NOMINATIM_USER_AGENT) ;
 *  - mise en cache des résultats pour éviter les requêtes répétées.
 */
import { env } from '../lib/env.js';
import { CacheTTL, LimiteurDebit } from './cache.js';

export interface ResultatGeocodage {
  label: string;
  lat: number;
  lng: number;
}

export class ServiceIndisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceIndisponibleError';
  }
}

const cache = new CacheTTL<ResultatGeocodage[]>(1000 * 60 * 60 * 24); // 24 h
const limiteur = new LimiteurDebit(1100); // > 1 s de marge

interface ReponseNominatim {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Mots qui précisent sans désigner le lieu : Nominatim échoue souvent avec
 * (« Carrefour Étoile Rouge » → rien ; « Étoile Rouge » → trouvé). Miroir de
 * MOTS_GENERIQUES dans client/src/lib/quartiers.ts.
 */
const MOTS_GENERIQUES = new Set([
  'carrefour', 'carref', 'carf', 'rond', 'point', 'quartier', 'qtier', 'qt', 'marche', 'pharmacie', 'eglise',
  'mosquee', 'ecole', 'college', 'ceg', 'lycee', 'plage', 'centre', 'ville', 'rue', 'von', 'pres', 'cote', 'face',
  'derriere', 'vers', 'non', 'loin', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'en',
]);

const sansAccents = (m: string) =>
  m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** La requête sans ses mots génériques, ou null s'il n'y a rien à retirer. */
export function sansMotsGeneriques(requete: string): string | null {
  const mots = requete.trim().split(/\s+/);
  const gardes = mots.filter((m) => !MOTS_GENERIQUES.has(sansAccents(m)));
  return gardes.length > 0 && gardes.length < mots.length && gardes.join(' ').length >= 3 ? gardes.join(' ') : null;
}

/**
 * Géocode une requête ; sans résultat, réessaie sans les mots génériques.
 * @throws ServiceIndisponibleError si Nominatim est injoignable.
 */
export async function geocoder(requete: string, limite = 5): Promise<ResultatGeocodage[]> {
  const r = await geocoderBrut(requete, limite);
  const repli = r.length === 0 ? sansMotsGeneriques(requete) : null;
  return repli ? geocoderBrut(repli, limite) : r;
}

/**
 * Géocode une requête texte et renvoie jusqu'à `limite` résultats.
 * @throws ServiceIndisponibleError si Nominatim est injoignable.
 */
async function geocoderBrut(requete: string, limite: number): Promise<ResultatGeocodage[]> {
  const q = requete.trim();
  if (q.length < 3) return [];

  const cle = `${q.toLowerCase()}|${limite}`;
  const enCache = cache.get(cle);
  if (enCache) return enCache;

  const url = new URL('/search', env.NOMINATIM_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('addressdetails', '0');
  if (env.GEOCODE_COUNTRYCODES) {
    url.searchParams.set('countrycodes', env.GEOCODE_COUNTRYCODES);
  }

  const resultats = await limiteur.planifier(async () => {
    let reponse: Response;
    try {
      reponse = await fetch(url, {
        headers: {
          'User-Agent': env.NOMINATIM_USER_AGENT,
          'Accept-Language': 'fr',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new ServiceIndisponibleError(
        'Le service de géocodage est injoignable. Vérifiez votre connexion.',
      );
    }
    if (!reponse.ok) {
      throw new ServiceIndisponibleError(
        `Le service de géocodage a répondu avec une erreur (${reponse.status}).`,
      );
    }
    const data = (await reponse.json()) as ReponseNominatim[];
    return data.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  });

  cache.set(cle, resultats);
  return resultats;
}
