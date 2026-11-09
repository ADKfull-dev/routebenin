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
  /** Repère (carrefour, marché, université…) plutôt que quartier. */
  repere?: boolean;
  /** Autres façons de l'écrire ou de le désigner (sigles, anciens noms). */
  alias?: string[];
}

/*
 * Coordonnées relevées dans OpenStreetMap (Nominatim, novembre 2026) : nœud du
 * quartier (place=suburb/neighbourhood/quarter) ou, à défaut, repère principal
 * du quartier. Les quartiers introuvables dans OSM ont été retirés plutôt que
 * placés au jugé. Vérification : `npx tsx` sur une liste de requêtes réelles
 * (voir README, « Recherche d'adresses »).
 */
export const QUARTIERS: Quartier[] = [
  // --- Cotonou ---
  { nom: 'Ganhi', ville: 'Cotonou', lat: 6.35476, lng: 2.4381 },
  { nom: 'Dantokpa (marché)', ville: 'Cotonou', lat: 6.37553, lng: 2.4314, alias: ['Tokpa', 'Marché Dantokpa'] },
  { nom: 'Akpakpa', ville: 'Cotonou', lat: 6.37029, lng: 2.44784, alias: ['Place Lénine'] },
  { nom: 'Fidjrossè', ville: 'Cotonou', lat: 6.3525, lng: 2.36755, alias: ['Fidjrosse'] },
  { nom: 'Cadjèhoun', ville: 'Cotonou', lat: 6.35848, lng: 2.39512 },
  { nom: 'Haie Vive', ville: 'Cotonou', lat: 6.35522, lng: 2.39761 },
  { nom: 'Les Cocotiers', ville: 'Cotonou', lat: 6.35294, lng: 2.39057 },
  { nom: 'Gbégamey', ville: 'Cotonou', lat: 6.36406, lng: 2.41305 },
  { nom: 'Jéricho', ville: 'Cotonou', lat: 6.37225, lng: 2.42595 },
  { nom: 'Vêdoko', ville: 'Cotonou', lat: 6.37997, lng: 2.39201, alias: ['Vedoko', 'Védoko'] },
  { nom: 'Sainte-Rita', ville: 'Cotonou', lat: 6.37921, lng: 2.41321 },
  { nom: 'Zongo', ville: 'Cotonou', lat: 6.35689, lng: 2.42734 },
  { nom: 'Gbèdjromèdé', ville: 'Cotonou', lat: 6.38088, lng: 2.42045, alias: ['Gbedjromede'] },
  { nom: 'Agla', ville: 'Cotonou', lat: 6.37547, lng: 2.36923 },
  { nom: 'Fifadji', ville: 'Cotonou', lat: 6.39286, lng: 2.40067 },
  { nom: 'Mènontin', ville: 'Cotonou', lat: 6.388, lng: 2.37356 },
  { nom: 'Houéyiho', ville: 'Cotonou', lat: 6.37241, lng: 2.39395, alias: ['Cité Houéyiho'] },
  { nom: 'Vodjè', ville: 'Cotonou', lat: 6.37202, lng: 2.40096 },
  { nom: 'Kouhounou', ville: 'Cotonou', lat: 6.38801, lng: 2.38004 },
  { nom: 'Avotrou', ville: 'Cotonou', lat: 6.37893, lng: 2.47204 },
  { nom: 'Sègbèya', ville: 'Cotonou', lat: 6.38313, lng: 2.44406 },
  { nom: 'Missèbo', ville: 'Cotonou', lat: 6.36546, lng: 2.4353 },
  { nom: 'Xwlacodji', ville: 'Cotonou', lat: 6.35318, lng: 2.43856 },
  { nom: 'Placodji', ville: 'Cotonou', lat: 6.35239, lng: 2.43303 },
  { nom: 'Ladji', ville: 'Cotonou', lat: 6.39075, lng: 2.43061 },
  { nom: 'Aïbatin', ville: 'Cotonou', lat: 6.36222, lng: 2.38013 },
  { nom: 'Zogbo', ville: 'Cotonou', lat: 6.39252, lng: 2.39429 },
  { nom: 'Agontinkon', ville: 'Cotonou', lat: 6.37571, lng: 2.40519 },
  // Repères de Cotonou
  { nom: 'Aéroport de Cotonou', ville: 'Cotonou', lat: 6.35775, lng: 2.38591, repere: true, alias: ['Aéroport Cardinal Bernardin Gantin'] },
  { nom: "Place de l'Étoile Rouge", ville: 'Cotonou', lat: 6.37146, lng: 2.40979, repere: true, alias: ['Étoile Rouge'] },
  { nom: 'Carrefour Saint-Michel', ville: 'Cotonou', lat: 6.36715, lng: 2.42987, repere: true },
  { nom: 'Carrefour Védoko', ville: 'Cotonou', lat: 6.3771, lng: 2.3898, repere: true, alias: ['Cica Toyota'] },
  { nom: 'Stade de l’Amitié', ville: 'Cotonou', lat: 6.386, lng: 2.38, repere: true, alias: ['Stade Mathieu Kérékou'] },
  { nom: 'Plage de Fidjrossè', ville: 'Cotonou', lat: 6.3492, lng: 2.3658, repere: true },
  { nom: 'Erevan', ville: 'Cotonou', lat: 6.349, lng: 2.387, repere: true, alias: ['Erevan Hypermarket'] },
  { nom: 'PK3', ville: 'Cotonou', lat: 6.37243, lng: 2.47207, repere: true, alias: ['PK 3'] },
  // --- Abomey-Calavi ---
  { nom: 'Abomey-Calavi (centre)', ville: 'Abomey-Calavi', lat: 6.45386, lng: 2.35425, alias: ['Calavi'] },
  { nom: 'Godomey', ville: 'Abomey-Calavi', lat: 6.38544, lng: 2.34324 },
  { nom: 'Cocotomey', ville: 'Abomey-Calavi', lat: 6.39178, lng: 2.30125 },
  { nom: 'Zogbadjè', ville: 'Abomey-Calavi', lat: 6.42363, lng: 2.33479 },
  { nom: 'Akassato', ville: 'Abomey-Calavi', lat: 6.50737, lng: 2.36564 },
  { nom: 'Togoudo', ville: 'Abomey-Calavi', lat: 6.40714, lng: 2.33452, alias: ['Godomey Togoudo'] },
  { nom: 'Hêvié', ville: 'Abomey-Calavi', lat: 6.44994, lng: 2.24059 },
  { nom: 'Tankpè', ville: 'Abomey-Calavi', lat: 6.42507, lng: 2.31931 },
  { nom: 'Womey', ville: 'Abomey-Calavi', lat: 6.40608, lng: 2.30469 },
  { nom: 'Kpanroun', ville: 'Abomey-Calavi', lat: 6.67394, lng: 2.36673 },
  // Repères d'Abomey-Calavi
  { nom: 'Université d’Abomey-Calavi', ville: 'Abomey-Calavi', lat: 6.4159, lng: 2.3417, repere: true, alias: ['UAC', 'Campus'] },
  { nom: 'IITA', ville: 'Abomey-Calavi', lat: 6.4213, lng: 2.3283, repere: true },
  { nom: 'Carrefour Kpota', ville: 'Abomey-Calavi', lat: 6.44597, lng: 2.35429, repere: true, alias: ['Kpota'] },
  { nom: 'Carrefour Houédonou', ville: 'Abomey-Calavi', lat: 6.39575, lng: 2.34369, repere: true, alias: ['Carrefour Godomey'] },
  { nom: 'Carrefour Tankpè', ville: 'Abomey-Calavi', lat: 6.42423, lng: 2.32045, repere: true },
  { nom: 'Marché de Womey', ville: 'Abomey-Calavi', lat: 6.40525, lng: 2.30571, repere: true },
  // --- Porto-Novo ---
  { nom: 'Porto-Novo (centre)', ville: 'Porto-Novo', lat: 6.49907, lng: 2.62534 },
  { nom: 'Ouando', ville: 'Porto-Novo', lat: 6.50477, lng: 2.60772 },
  { nom: 'Tokpota', ville: 'Porto-Novo', lat: 6.49221, lng: 2.6012 },
  { nom: 'Houinmè', ville: 'Porto-Novo', lat: 6.49594, lng: 2.62106 },
  { nom: 'Djègan-Kpèvi', ville: 'Porto-Novo', lat: 6.50589, lng: 2.62051 },
  // --- Sèmè-Kpodji ---
  { nom: 'Carrefour Sèmè-Podji', ville: 'Sèmè-Kpodji', lat: 6.37752, lng: 2.59379, repere: true, alias: ['Sèmè-Podji'] },
  { nom: 'Carrefour PK10', ville: 'Sèmè-Kpodji', lat: 6.3705, lng: 2.5213, repere: true, alias: ['PK 10', 'PK10'] },
];

/** Normalise : minuscules, sans accents, sans ponctuation superflue. */
export function normaliser(s: string): string {
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

/** Abréviations courantes, développées avant la recherche. */
const ABREVIATIONS: Record<string, string> = { st: 'saint', ste: 'sainte', stes: 'saintes', pn: 'porto novo', ctn: 'cotonou' };

/**
 * Mots qui précisent sans désigner le lieu (« carrefour Vèdoko », « pharmacie
 * de Cadjèhoun ») : ignorés s'il reste d'autres mots, car on cherche le quartier.
 */
const MOTS_GENERIQUES = new Set([
  'carrefour', 'carref', 'carf', 'rond', 'point', 'quartier', 'qtier', 'qt', 'marche', 'pharmacie', 'eglise',
  'mosquee', 'ecole', 'college', 'ceg', 'lycee', 'plage', 'centre', 'ville', 'rue', 'von', 'pres', 'cote', 'face',
  'derriere', 'vers', 'non', 'loin', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'en',
]);

/**
 * La requête sans ses mots génériques, accents conservés (« Carrefour Étoile
 * Rouge » → « Étoile Rouge ») : second essai pour Nominatim, qui échoue souvent
 * avec le mot « carrefour ». null si rien à retirer.
 */
export function sansMotsGeneriques(requete: string): string | null {
  const mots = requete.trim().split(/\s+/);
  const gardes = mots.filter((m) => !MOTS_GENERIQUES.has(normaliser(m)));
  return gardes.length > 0 && gardes.length < mots.length && gardes.join(' ').length >= 3 ? gardes.join(' ') : null;
}

/** Requête prête pour la recherche : normalisée, abréviations développées. */
export function preparerRequete(requete: string): { texte: string; mots: string[] } {
  const brut = normaliser(requete)
    .split(' ')
    .filter(Boolean)
    .flatMap((m) => (ABREVIATIONS[m] ?? m).split(' '));
  const utiles = brut.filter((m) => !MOTS_GENERIQUES.has(m));
  const mots = utiles.length > 0 ? utiles : brut;
  return { texte: brut.join(' '), mots };
}

/** Correspondance d'un mot de la requête avec un mot du lieu (plus bas = mieux). */
function noteMot(mot: string, cible: string): number | null {
  if (cible.startsWith(mot)) return 0;
  if (mot.length < 4) return null;
  const d = levenshtein(mot, cible.slice(0, Math.max(mot.length, cible.length)));
  return d <= Math.max(1, Math.floor(cible.length * 0.34)) ? d * 0.5 : null;
}

/**
 * Score d'une requête de plusieurs mots (« Godomey Togoudo », « Porto-Novo
 * Ouando », « carrefour Vèdoko ») : chaque mot doit se retrouver dans le nom du
 * lieu ou dans son contexte (commune, département, alias), et au moins un dans
 * le nom. Renvoie null sinon.
 */
export function scoreMots(mots: string[], nomNorm: string, contexteNorm: string): number | null {
  const motsNom = nomNorm.split(' ');
  const motsContexte = contexteNorm.split(' ').filter(Boolean);
  let total = 0;
  // Au moins un mot doit commencer un mot du nom sans faute : sinon, deux
  // approximations cumulées font remonter des homonymes lointains.
  let dansNom = false;
  for (const m of mots) {
    let meilleur: number | null = null;
    for (const c of motsNom) {
      const n = noteMot(m, c);
      if (n !== null && (meilleur === null || n < meilleur)) meilleur = n;
    }
    if (meilleur === 0) dansNom = true;
    if (meilleur === null) {
      for (const c of motsContexte) {
        const n = noteMot(m, c);
        if (n !== null && (meilleur === null || n + 0.3 < meilleur)) meilleur = n + 0.3;
      }
    }
    if (meilleur === null) return null;
    total += meilleur;
  }
  return dansNom ? 0.25 + total / mots.length : null;
}

/**
 * Score de pertinence d'un quartier pour une requête (plus bas = plus proche).
 * Tolère accents manquants et fautes de frappe. Renvoie null si trop éloigné.
 */
export function score(requeteNorm: string, nomNorm: string): number | null {
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
export function chercherQuartiers(
  requete: string,
  limite = 6,
): (ResultatGeocodage & { approche: boolean; type: 'Quartier' | 'Repère' })[] {
  const { texte, mots } = preparerRequete(requete);
  const q = mots.join(' ');
  if (q.length < 2) return [];
  const notes: { q: Quartier; s: number }[] = [];
  for (const quartier of QUARTIERS) {
    const noms = [quartier.nom, ...(quartier.alias ?? [])].map(normaliser);
    let meilleur: number | null = null;
    for (const nom of noms) {
      const complet = `${nom} ${normaliser(quartier.ville)}`;
      const candidats = [
        score(texte, complet),
        score(q, complet),
        mots.length > 1 ? scoreMots(mots, nom, normaliser(quartier.ville)) : null,
      ];
      for (const c of candidats) if (c !== null && (meilleur === null || c < meilleur)) meilleur = c;
    }
    if (meilleur !== null) notes.push({ q: quartier, s: meilleur });
  }
  notes.sort((a, b) => a.s - b.s);
  return notes.slice(0, limite).map(({ q: x, s }) => ({
    label: `${x.nom}, ${x.ville}`,
    lat: x.lat,
    lng: x.lng,
    // Trouvé seulement en tolérant des fautes (pas de préfixe ni de sous-chaîne).
    approche: s >= 1,
    type: x.repere ? 'Repère' : 'Quartier',
  }));
}
