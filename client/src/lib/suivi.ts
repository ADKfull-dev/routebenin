/**
 * suivi — mode livreur : la tournée voyage dans un lien, l'avancement reste
 * sur le téléphone du livreur.
 *
 *  - `FeuilleLivreur` : version compacte de la tournée (adresses courtes,
 *    coordonnées, heures prévues, colis, contact), compressée dans l'URL
 *    (`#/livreur?f=…`). Pas de compte ni de serveur : le lien envoyé sur
 *    WhatsApp suffit, et la page marche hors-ligne une fois ouverte.
 *  - `Suivi` : ordre restant, statut de chaque arrêt (livré / absent),
 *    stocké dans localStorage sous une clé dérivée de la feuille.
 *  - `compteRendu` : le texte que le livreur renvoie au responsable.
 */
import { infosHoraire, libelleCourt, parcours, type InfosFeuille } from './feuilleRoute';
import { formatHeure, libelleFenetre } from './horaires';

/** Un point de la feuille (clés courtes : le tout tient dans une URL). */
export interface PointFeuille {
  /** libellé court */
  l: string;
  /** latitude, longitude (5 décimales ≈ 1 m) */
  a: number;
  o: number;
  /** heure prévue (secondes depuis minuit) */
  h?: number;
  /** colis (si ≠ 1), créneau [début, fin] « HH:MM », téléphone, indication */
  c?: number;
  w?: [string | null, string | null];
  t?: string;
  n?: string;
}

export interface FeuilleLivreur {
  v: 1;
  /** nom de la tournée, entreprise */
  n: string;
  e?: string;
  /** départ, livraisons dans l'ordre optimisé, arrivée distincte éventuelle */
  d: PointFeuille;
  p: PointFeuille[];
  r?: PointFeuille;
  /** retour au départ en fin de tournée */
  b: boolean;
  /** minutes par livraison (recalcul des heures) */
  m?: number;
}

export type Statut = 'livre' | 'absent';

export interface EtatArret {
  s: Statut;
  /** horodatage (ms) */
  t: number;
  /** motif d'absence ou remarque */
  r?: string;
}

export interface Suivi {
  /** indices (dans `feuille.p`) des arrêts restants, dans l'ordre de passage */
  ordre: number[];
  /** statut des arrêts traités, par indice */
  etats: Record<number, EtatArret>;
  /** heures prévues recalculées après ré-optimisation (secondes depuis minuit) */
  heures?: Record<number, number>;
  debut?: number;
}

/* ---------- Construction ---------- */

const arrondi = (x: number) => Math.round(x * 1e5) / 1e5;

export function feuilleDepuisResultat(infos: InfosFeuille): FeuilleLivreur {
  const pts = parcours(infos);
  // Dernier point : retour au dépôt (boucle) ou arrivée distincte — pas une livraison.
  const finDistincte = !infos.boucle && pts.length > 2;
  const dernierLivrable = infos.boucle || finDistincte ? pts.length - 2 : pts.length - 1;
  const point = (i: number): PointFeuille => {
    const a = pts[i];
    const { colis } = infosHoraire(infos, i, pts.length);
    const p: PointFeuille = { l: libelleCourt(a.label).slice(0, 80), a: arrondi(a.lat), o: arrondi(a.lng) };
    const passage = i > 0 ? infos.resultat.horaires?.passages[i - 1] : undefined;
    if (i > 0 && i <= dernierLivrable && passage) p.h = Math.round(passage.arrivee);
    if (colis !== null) p.c = colis;
    if (i > 0 && i <= dernierLivrable) {
      if (a.fenetre && (a.fenetre.debut || a.fenetre.fin)) p.w = [a.fenetre.debut, a.fenetre.fin];
      if (a.telephone) p.t = a.telephone.slice(0, 30);
      if (a.note) p.n = a.note.slice(0, 200);
    }
    return p;
  };
  const f: FeuilleLivreur = {
    v: 1,
    n: (infos.nom?.trim() || 'Tournée').slice(0, 80),
    d: point(0),
    p: Array.from({ length: Math.max(0, dernierLivrable) }, (_, k) => point(k + 1)),
    b: infos.boucle,
  };
  if (infos.entreprise) f.e = infos.entreprise.slice(0, 80);
  if (finDistincte) f.r = point(pts.length - 1);
  if (infos.resultat.minutesParLivraison != null) f.m = infos.resultat.minutesParLivraison;
  const h0 = infos.resultat.horaires?.heureDepart;
  if (h0 !== undefined) f.d.h = h0;
  return f;
}

/* ---------- Encodage dans l'URL (deflate + base64url) ---------- */

const versB64 = (o: Uint8Array) => {
  let s = '';
  o.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const depuisB64 = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function transformer(octets: Uint8Array, flux: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const sortie = new Blob([octets]).stream().pipeThrough(flux);
  return new Uint8Array(await new Response(sortie).arrayBuffer());
}

/** « z… » = compressé ; « j… » = JSON brut (navigateurs sans CompressionStream). */
export async function encoderFeuille(f: FeuilleLivreur): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(f));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + versB64(await transformer(json, new CompressionStream('deflate-raw')));
  }
  return 'j' + versB64(json);
}

export async function decoderFeuille(code: string): Promise<FeuilleLivreur> {
  let octets = depuisB64(code.slice(1));
  if (code[0] === 'z') octets = await transformer(octets, new DecompressionStream('deflate-raw'));
  else if (code[0] !== 'j') throw new Error('format');
  const f = JSON.parse(new TextDecoder().decode(octets)) as FeuilleLivreur;
  if (f.v !== 1 || !Array.isArray(f.p) || !f.d) throw new Error('format');
  return f;
}

export function lienLivreur(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/livreur?f=${code}`;
}

/* ---------- Avancement (localStorage) ---------- */

/** Empreinte stable de la feuille (FNV-1a 32 bits) : même lien → même suivi. */
export function cleFeuille(f: FeuilleLivreur): string {
  const s = JSON.stringify(f);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `routebenin.suivi.${(h >>> 0).toString(36)}`;
}

export function suiviInitial(f: FeuilleLivreur): Suivi {
  return { ordre: f.p.map((_, i) => i), etats: {} };
}

export function lireSuivi(f: FeuilleLivreur): Suivi | null {
  try {
    const brut = localStorage.getItem(cleFeuille(f));
    if (!brut) return null;
    const s = JSON.parse(brut) as Suivi;
    // Garde-fou : chaque arrêt est soit restant, soit traité, une seule fois.
    const vus = new Set([...s.ordre, ...Object.keys(s.etats).map(Number)]);
    return vus.size === f.p.length && s.ordre.every((i) => i >= 0 && i < f.p.length) ? s : null;
  } catch {
    return null;
  }
}

export function ecrireSuivi(f: FeuilleLivreur, s: Suivi): void {
  try {
    localStorage.setItem(cleFeuille(f), JSON.stringify(s));
  } catch {
    /* mode privé / quota : l'avancement ne survivra pas au rechargement */
  }
}

/* ---------- Transitions ---------- */

export function marquer(s: Suivi, i: number, statut: Statut, remarque?: string): Suivi {
  return {
    ...s,
    ordre: s.ordre.filter((x) => x !== i),
    etats: { ...s.etats, [i]: { s: statut, t: Date.now(), ...(remarque ? { r: remarque } : {}) } },
    debut: s.debut ?? Date.now(),
  };
}

/** Annule le statut d'un arrêt : il redevient le prochain arrêt (ou le dernier, `aLaFin`). */
export function reprendre(s: Suivi, i: number, aLaFin = false): Suivi {
  const etats = { ...s.etats };
  delete etats[i];
  const reste = s.ordre.filter((x) => x !== i);
  return { ...s, etats, ordre: aLaFin ? [...reste, i] : [i, ...reste] };
}

export function deplacer(s: Suivi, rang: number, vers: number): Suivi {
  if (vers < 0 || vers >= s.ordre.length || rang === vers) return s;
  const ordre = s.ordre.slice();
  const [x] = ordre.splice(rang, 1);
  ordre.splice(vers, 0, x);
  return { ...s, ordre, heures: undefined };
}

export function bilan(f: FeuilleLivreur, s: Suivi) {
  const etats = Object.values(s.etats);
  const livres = etats.filter((e) => e.s === 'livre').length;
  const absents = etats.filter((e) => e.s === 'absent').length;
  const colisLivres = Object.entries(s.etats)
    .filter(([, e]) => e.s === 'livre')
    .reduce((t, [i]) => t + (f.p[Number(i)]?.c ?? 1), 0);
  return { livres, absents, restants: s.ordre.length, total: f.p.length, colisLivres, termine: s.ordre.length === 0 };
}

/* ---------- Liens pratiques ---------- */

export const lienNavigation = (p: PointFeuille) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${p.a},${p.o}`;

/** Lien d'appel : on garde chiffres et « + ». */
export const lienAppel = (tel: string) => `tel:${tel.replace(/[^\d+]/g, '')}`;

const heureMs = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Compte-rendu texte envoyé au responsable (WhatsApp). */
export function compteRendu(f: FeuilleLivreur, s: Suivi): string {
  const b = bilan(f, s);
  const l: string[] = [];
  l.push(`📋 *Compte-rendu — ${f.n}*${f.e ? ` (${f.e})` : ''}`);
  l.push(`✅ ${b.livres} livrée${b.livres > 1 ? 's' : ''} · ❌ ${b.absents} non livrée${b.absents > 1 ? 's' : ''}${b.restants ? ` · ⏳ ${b.restants} restante${b.restants > 1 ? 's' : ''}` : ''} (sur ${b.total})`);
  l.push('');
  f.p.forEach((p, i) => {
    const e = s.etats[i];
    const statut = !e ? '⏳ à faire' : e.s === 'livre' ? `✅ livré à ${heureMs(e.t)}` : `❌ ${e.r ?? 'absent'} (${heureMs(e.t)})`;
    l.push(`${i + 1}. ${p.l} — ${statut}`);
  });
  l.push('');
  l.push('— Envoyé depuis RouteBénin');
  return l.join('\n');
}

/** Détails affichables d'un arrêt : créneau, colis, heure prévue. */
export function detailsPoint(p: PointFeuille, heure?: number): string[] {
  return [
    heure !== undefined ? `vers ${formatHeure(heure)}` : p.h !== undefined ? `vers ${formatHeure(p.h)}` : null,
    p.w ? `créneau ${libelleFenetre({ debut: p.w[0], fin: p.w[1] })}` : null,
    p.c !== undefined ? `${p.c} colis` : null,
  ].filter((x): x is string => !!x);
}

