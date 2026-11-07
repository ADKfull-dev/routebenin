/**
 * lieuxBenin — répertoire national des lieux (77 communes, ~12 500 villes,
 * villages, hameaux et quartiers, données OpenStreetMap), avec recherche
 * tolérante aux fautes. Généré par `npm run lieux-benin` (server/) dans
 * data/lieuxBenin.json, chargé à la demande (fichier séparé, ~170 Ko compressé)
 * et gardé hors ligne par le service worker comme le reste de l'application.
 */
import type { ResultatGeocodage } from '../types';
import { normaliser, score } from './quartiers';

interface Fichier {
  departements: string[];
  communes: [string, number, number, number][];
  lieux: [string, number, number, number, number][];
}

/** Rang : 0 ville, 1 bourg, 2 village ou quartier, 3 hameau ; -1 commune. */
export interface Lieu {
  nom: string;
  commune: string;
  departement: string;
  lat: number;
  lng: number;
  rang: number;
  /** Nom normalisé (recherche). */
  cle: string;
}

let chargement: Promise<Lieu[]> | null = null;

export function chargerLieux(): Promise<Lieu[]> {
  chargement ??= import('../data/lieuxBenin.json')
    .then((m) => {
      const f = m.default as unknown as Fichier;
      const lieux: Lieu[] = f.lieux.map(([nom, lat, lng, c, rang]) => {
        const [commune, d] = f.communes[c];
        return { nom, commune, departement: f.departements[d], lat, lng, rang, cle: normaliser(nom) };
      });
      // Chaque commune est cherchable, même sans lieu du même nom dans OSM.
      f.communes.forEach(([nom, d, lat, lng]) => {
        if (!lieux.some((l) => l.commune === nom && l.cle === normaliser(nom))) {
          lieux.push({ nom, commune: nom, departement: f.departements[d], lat, lng, rang: -1, cle: normaliser(nom) });
        }
      });
      return lieux;
    })
    .catch(() => {
      chargement = null; // nouvel essai à la prochaine recherche
      return [];
    });
  return chargement;
}

export function libelleLieu(l: Lieu): string {
  return l.nom === l.commune || l.rang === -1 ? `${l.nom}, ${l.departement}` : `${l.nom}, ${l.commune}`;
}

export const TYPE_LIEU = ['Commune', 'Ville', 'Ville', 'Localité', 'Hameau'] as const;
export const typeLieu = (rang: number) => TYPE_LIEU[rang + 1] ?? 'Localité';

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos((a.lat * Math.PI) / 180);
  return 6371 * Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Recherche dans le répertoire national. Les villes passent avant les hameaux ;
 * `proche` (ex. : le point de départ) favorise les homonymes voisins.
 */
export async function chercherLieux(
  requete: string,
  { limite = 6, proche }: { limite?: number; proche?: { lat: number; lng: number } | null } = {},
): Promise<(ResultatGeocodage & { type: string })[]> {
  const q = normaliser(requete);
  if (q.length < 2) return [];
  const lieux = await chargerLieux();
  const notes: { l: Lieu; s: number }[] = [];
  // 1er passage : préfixes et sous-chaînes (rapide) ; fautes de frappe ensuite si besoin.
  for (const l of lieux) {
    const s = l.cle.startsWith(q) ? 0 : l.cle.includes(q) ? 0.5 : null;
    if (s !== null) notes.push({ l, s });
  }
  if (notes.length < limite && q.length >= 4) {
    const deja = new Set(notes.map((n) => n.l));
    for (const l of lieux) {
      if (deja.has(l) || Math.abs(l.cle.length - q.length) > Math.ceil(q.length * 0.6)) continue;
      const s = score(q, l.cle);
      if (s !== null) notes.push({ l, s });
    }
  }
  const note = ({ l, s }: { l: Lieu; s: number }) =>
    s + (l.rang + 1) * 0.15 + (proche ? Math.min(1, km(proche, l) / 300) * 0.6 : 0);
  notes.sort((a, b) => note(a) - note(b));
  return notes.slice(0, limite).map(({ l }) => ({ label: libelleLieu(l), lat: l.lat, lng: l.lng, type: typeLieu(l.rang) }));
}
