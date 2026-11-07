/**
 * lieuxBenin.ts — Génère le répertoire des lieux du Bénin à partir
 * d'OpenStreetMap (API Overpass) : 12 départements, 77 communes et tous les
 * lieux habités nommés (villes, villages, hameaux, quartiers).
 *
 * Lancer : `npm run lieux-benin` (depuis server/) → client/src/data/lieuxBenin.json
 *
 * Chaque lieu est rattaché à sa commune et à son département par un test
 * « point dans polygone » (règle pair-impair sur tous les segments des contours
 * de la commune : pas besoin de recoller les morceaux des contours).
 *
 * Format compact (le fichier est chargé à la demande par le navigateur) :
 *   departements: [nom]
 *   communes:     [nom, indexDépartement, lat, lng]
 *   lieux:        [nom, lat, lng, indexCommune, rang]
 *     rang 0 = ville, 1 = bourg, 2 = village ou quartier, 3 = hameau
 *
 * Données © contributeurs OpenStreetMap, licence ODbL.
 */
import net from 'node:net';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

net.setDefaultAutoSelectFamilyAttemptTimeout(2500); // réseau lent (voir index.ts)

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const SORTIE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../client/src/data/lieuxBenin.json');
const ZONE = 'area["ISO3166-1"="BJ"][admin_level=2]->.bj;';

interface Element {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
}

async function overpass(requete: string): Promise<Element[]> {
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const r = await fetch(OVERPASS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass refuse les clients non identifiés (406).
          'User-Agent': 'RouteBenin/1.0 (generation du repertoire des lieux)',
        },
        body: new URLSearchParams({ data: `[out:json][timeout:250];${ZONE}${requete}` }),
        signal: AbortSignal.timeout(300_000),
      });
      if (r.ok) return ((await r.json()) as { elements: Element[] }).elements;
      console.warn(`Overpass : HTTP ${r.status} (essai ${essai})`);
    } catch (e) {
      console.warn(`Overpass : ${(e as Error).message} (essai ${essai})`);
    }
    await new Promise((ok) => setTimeout(ok, 10_000 * essai));
  }
  throw new Error('Overpass injoignable.');
}

type Segment = [number, number, number, number]; // lat1, lng1, lat2, lng2

interface Zone {
  nom: string;
  segments: Segment[];
  /** Boîte englobante, pour écarter vite les zones lointaines. */
  boite: [number, number, number, number];
  centre: [number, number];
}

function versZone(e: Element): Zone | null {
  const segments: Segment[] = [];
  for (const m of e.members ?? []) {
    if (m.type !== 'way' || !m.geometry || (m.role !== 'outer' && m.role !== 'inner')) continue;
    for (let i = 1; i < m.geometry.length; i++) {
      const a = m.geometry[i - 1];
      const b = m.geometry[i];
      segments.push([a.lat, a.lon, b.lat, b.lon]);
    }
  }
  if (!segments.length || !e.tags?.name) return null;
  const lats = segments.flatMap((s) => [s[0], s[2]]);
  const lngs = segments.flatMap((s) => [s[1], s[3]]);
  const boite: Zone['boite'] = [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)];
  return { nom: e.tags.name, segments, boite, centre: [(boite[0] + boite[2]) / 2, (boite[1] + boite[3]) / 2] };
}

/** Règle pair-impair : un rayon vers l'est coupe un nombre impair de segments. */
function contient(z: Zone, lat: number, lng: number): boolean {
  const [la0, lo0, la1, lo1] = z.boite;
  if (lat < la0 || lat > la1 || lng < lo0 || lng > lo1) return false;
  let dedans = false;
  for (const [y1, x1, y2, x2] of z.segments) {
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) dedans = !dedans;
  }
  return dedans;
}

const RANG: Record<string, number> = {
  city: 0,
  town: 1,
  village: 2,
  suburb: 2,
  quarter: 2,
  neighbourhood: 2,
  hamlet: 3,
  locality: 3,
};

const arrondi = (x: number) => Math.round(x * 1e5) / 1e5;
const normaliser = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  console.log('Contours des départements et communes…');
  const admin = await overpass('(relation["boundary"="administrative"]["admin_level"~"^(4|6)$"](area.bj););out geom;');
  const departements = admin.filter((e) => e.tags?.admin_level === '4').map(versZone).filter((z): z is Zone => !!z);
  const communes = admin.filter((e) => e.tags?.admin_level === '6').map(versZone).filter((z): z is Zone => !!z);
  console.log(`  ${departements.length} départements, ${communes.length} communes`);

  console.log('Lieux habités…');
  const places = await overpass(
    '(node["place"~"^(city|town|village|suburb|quarter|neighbourhood|hamlet|locality)$"]["name"](area.bj););out body;',
  );
  console.log(`  ${places.length} lieux nommés`);

  const departementDe = (lat: number, lng: number) => departements.findIndex((d) => contient(d, lat, lng));
  const communeDe = (lat: number, lng: number) => communes.findIndex((c) => contient(c, lat, lng));

  // Lieux : rattachés à leur commune, doublons (même nom, même commune) fusionnés.
  const vus = new Map<string, [string, number, number, number, number]>();
  let horsCommune = 0;
  for (const p of places) {
    if (p.lat === undefined || p.lon === undefined) continue;
    const nom = p.tags?.['name:fr'] ?? p.tags!.name;
    const commune = communeDe(p.lat, p.lon);
    if (commune < 0) {
      horsCommune++;
      continue;
    }
    const rang = RANG[p.tags!.place] ?? 3;
    const cle = `${normaliser(nom)}|${commune}`;
    const existant = vus.get(cle);
    if (!existant || rang < existant[4]) vus.set(cle, [nom, arrondi(p.lat), arrondi(p.lon), commune, rang]);
  }
  const lieux = [...vus.values()].sort((a, b) => a[4] - b[4] || a[0].localeCompare(b[0], 'fr'));

  // Département de chaque commune : vote des lieux situés À L'INTÉRIEUR de la
  // commune (les points du contour tombent sur les frontières, donc ambigus).
  const tableCommunes = communes.map((c, ic) => {
    const votes = new Map<number, number>();
    const interieurs = lieux.filter((l) => l[3] === ic);
    const pas = Math.max(1, Math.floor(interieurs.length / 60));
    for (let i = 0; i < interieurs.length; i += pas) {
      const d = departementDe(interieurs[i][1], interieurs[i][2]);
      if (d >= 0) votes.set(d, (votes.get(d) ?? 0) + 1);
    }
    const dep = [...votes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? departementDe(c.centre[0], c.centre[1]);
    return [c.nom, dep, arrondi(c.centre[0]), arrondi(c.centre[1])] as [string, number, number, number];
  });

  // Centre de commune : la ville ou le bourg du même nom s'il existe (plus juste que le centre du contour).
  for (const c of tableCommunes) {
    const chef = lieux.find((l) => l[3] === tableCommunes.indexOf(c) && normaliser(l[0]) === normaliser(c[0]));
    if (chef) {
      c[2] = chef[1];
      c[3] = chef[2];
    }
  }

  const sortie = {
    source: 'OpenStreetMap (ODbL), via Overpass',
    genereLe: new Date().toISOString().slice(0, 10),
    departements: departements.map((d) => d.nom),
    communes: tableCommunes,
    lieux,
  };
  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, JSON.stringify(sortie));
  console.log(`Écrit ${SORTIE} : ${tableCommunes.length} communes, ${lieux.length} lieux (${horsCommune} hors commune ignorés).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
