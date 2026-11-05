/**
 * quartiers.ts — Répertoire local des quartiers du Grand Cotonou
 * (Cotonou, Abomey-Calavi, Porto-Novo et environs) avec recherche tolérante
 * aux fautes d'orthographe.
 *
 * Pourquoi : le service public Nominatim couvre mal certains quartiers du Bénin.
 * Ce répertoire garantit qu'ils apparaissent toujours, et la recherche floue
 * propose les résultats les plus proches de ce que la personne a tapé, même
 * avec des accents manquants ou des fautes de frappe.
 */
import type { ResultatGeocodage } from '../types';

interface Quartier {
  nom: string;
  ville: string;
  lat: number;
  lng: number;
}

export const QUARTIERS: Quartier[] = [
  // --- Cotonou ---
  { nom: 'Ganhi', ville: 'Cotonou', lat: 6.3622, lng: 2.4281 },
  { nom: 'Dantokpa (marché)', ville: 'Cotonou', lat: 6.3722, lng: 2.43 },
  { nom: 'Akpakpa', ville: 'Cotonou', lat: 6.362, lng: 2.435 },
  { nom: 'Fidjrossè', ville: 'Cotonou', lat: 6.358, lng: 2.355 },
  { nom: 'Cadjèhoun', ville: 'Cotonou', lat: 6.365, lng: 2.39 },
  { nom: 'Aéroport de Cotonou', ville: 'Cotonou', lat: 6.3572, lng: 2.3844 },
  { nom: 'Haie Vive', ville: 'Cotonou', lat: 6.363, lng: 2.4 },
  { nom: 'Les Cocotiers', ville: 'Cotonou', lat: 6.37, lng: 2.41 },
  { nom: 'Gbégamey', ville: 'Cotonou', lat: 6.375, lng: 2.405 },
  { nom: 'Jéricho', ville: 'Cotonou', lat: 6.368, lng: 2.395 },
  { nom: 'Vêdoko', ville: 'Cotonou', lat: 6.385, lng: 2.385 },
  { nom: 'Sainte-Rita', ville: 'Cotonou', lat: 6.373, lng: 2.415 },
  { nom: "Place de l'Étoile Rouge", ville: 'Cotonou', lat: 6.376, lng: 2.42 },
  { nom: 'Zongo', ville: 'Cotonou', lat: 6.364, lng: 2.425 },
  { nom: 'Gbèdjromédé', ville: 'Cotonou', lat: 6.378, lng: 2.41 },
  { nom: 'Agla', ville: 'Cotonou', lat: 6.38, lng: 2.37 },
  { nom: 'Fifadji', ville: 'Cotonou', lat: 6.381, lng: 2.395 },
  { nom: 'Mènontin', ville: 'Cotonou', lat: 6.388, lng: 2.39 },
  { nom: 'Houéyiho', ville: 'Cotonou', lat: 6.369, lng: 2.388 },
  { nom: 'Vodjè', ville: 'Cotonou', lat: 6.372, lng: 2.4 },
  { nom: 'Kouhounou', ville: 'Cotonou', lat: 6.39, lng: 2.4 },
  { nom: 'Avotrou', ville: 'Cotonou', lat: 6.37, lng: 2.44 },
  { nom: 'Sègbèya', ville: 'Cotonou', lat: 6.367, lng: 2.42 },
  { nom: 'Missèbo', ville: 'Cotonou', lat: 6.368, lng: 2.428 },
  { nom: 'Xwlacodji', ville: 'Cotonou', lat: 6.353, lng: 2.42 },
  { nom: 'Placodji', ville: 'Cotonou', lat: 6.355, lng: 2.43 },
  { nom: 'Ladji', ville: 'Cotonou', lat: 6.38, lng: 2.43 },
  { nom: 'Aïbatin', ville: 'Cotonou', lat: 6.383, lng: 2.38 },
  { nom: 'Sikècodji', ville: 'Cotonou', lat: 6.366, lng: 2.42 },
  { nom: 'Zogbo', ville: 'Cotonou', lat: 6.383, lng: 2.4 },
  { nom: 'Tokpa-Hoho', ville: 'Cotonou', lat: 6.382, lng: 2.42 },
  { nom: 'Agontinkon', ville: 'Cotonou', lat: 6.36, lng: 2.41 },
  // --- Abomey-Calavi ---
  { nom: 'Abomey-Calavi (centre)', ville: 'Abomey-Calavi', lat: 6.4489, lng: 2.3556 },
  { nom: 'Godomey', ville: 'Abomey-Calavi', lat: 6.3833, lng: 2.3333 },
  { nom: 'Cocotomey', ville: 'Abomey-Calavi', lat: 6.4, lng: 2.3 },
  { nom: 'Zogbadjè', ville: 'Abomey-Calavi', lat: 6.42, lng: 2.345 },
  { nom: 'Akassato', ville: 'Abomey-Calavi', lat: 6.49, lng: 2.35 },
  { nom: 'Togoudo', ville: 'Abomey-Calavi', lat: 6.44, lng: 2.33 },
  { nom: 'Hêvié', ville: 'Abomey-Calavi', lat: 6.41, lng: 2.27 },
  { nom: 'Tankpè', ville: 'Abomey-Calavi', lat: 6.43, lng: 2.36 },
  { nom: 'Womey', ville: 'Abomey-Calavi', lat: 6.46, lng: 2.37 },
  { nom: 'Kpanroun', ville: 'Abomey-Calavi', lat: 6.53, lng: 2.35 },
  // --- Porto-Novo ---
  { nom: 'Porto-Novo (centre)', ville: 'Porto-Novo', lat: 6.4969, lng: 2.6283 },
  { nom: 'Ouando', ville: 'Porto-Novo', lat: 6.49, lng: 2.63 },
  { nom: 'Tokpota', ville: 'Porto-Novo', lat: 6.48, lng: 2.62 },
  { nom: 'Houinmè', ville: 'Porto-Novo', lat: 6.495, lng: 2.61 },
  { nom: 'Djègan-Kpèvi', ville: 'Porto-Novo', lat: 6.47, lng: 2.63 },
  // --- Sèmè-Podji ---
  { nom: 'Sèmè-Podji', ville: 'Sèmè-Podji', lat: 6.37, lng: 2.6 },
];

/** Normalise : minuscules, sans accents, sans ponctuation superflue. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distance de Levenshtein (nombre d'éditions) entre deux chaînes. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cout);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * Score de pertinence d'un quartier pour une requête (plus bas = plus proche).
 * Tolère accents manquants et fautes de frappe. Renvoie null si trop éloigné.
 */
function score(requeteNorm: string, nomNorm: string): number | null {
  if (nomNorm.startsWith(requeteNorm)) return 0; // préfixe : meilleur score
  if (nomNorm.includes(requeteNorm)) return 0.5; // sous-chaîne
  // Fautes de frappe : on compare la requête au meilleur mot du nom.
  const mots = nomNorm.split(' ');
  let meilleur = Infinity;
  for (const mot of [nomNorm, ...mots]) {
    const d = levenshtein(requeteNorm, mot);
    const tolerance = Math.max(1, Math.floor(mot.length * 0.4)); // ~40 % d'écart toléré
    if (d <= tolerance) meilleur = Math.min(meilleur, 1 + d);
  }
  return Number.isFinite(meilleur) ? meilleur : null;
}

/** Recherche floue dans le répertoire local. Renvoie les plus proches d'abord. */
export function chercherQuartiers(requete: string, limite = 6): ResultatGeocodage[] {
  const q = normaliser(requete);
  if (q.length < 2) return [];
  const notes: { q: Quartier; s: number }[] = [];
  for (const quartier of QUARTIERS) {
    const s = score(q, normaliser(`${quartier.nom} ${quartier.ville}`));
    if (s !== null) notes.push({ q: quartier, s });
  }
  notes.sort((a, b) => a.s - b.s);
  return notes.slice(0, limite).map(({ q: x }) => ({
    label: `${x.nom}, ${x.ville}`,
    lat: x.lat,
    lng: x.lng,
  }));
}
