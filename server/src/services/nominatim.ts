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
 * Géocode une requête texte et renvoie jusqu'à `limite` résultats.
 * @throws ServiceIndisponibleError si Nominatim est injoignable.
 */
export async function geocoder(
  requete: string,
  limite = 5,
): Promise<ResultatGeocodage[]> {
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
