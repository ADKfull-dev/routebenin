/**
 * packDemo.ts — Génère le « pack démo » : données routières OSRM réelles,
 * pré-calculées pour les 15 points de l'exemple de Cotonou.
 *
 * Lancer : `npm run pack-demo` (depuis server/) → client/src/data/packDemo.json
 *
 * Contenu :
 *   - matrice des distances (m) et durées (s) entre les 15 points ;
 *   - géométrie routière de chacun des 210 trajets point → point (les deux
 *     sens : les distances routières sont asymétriques), en polyline encodée.
 *
 * L'application rejoue n'importe quel ordre de passage en mettant bout à bout
 * ces tronçons : la démonstration ne dépend plus du serveur OSRM public
 * (quotas, indisponibilité, réseau de la salle de soutenance).
 *
 * Usage poli du serveur public : une requête à la fois, ~1 par seconde.
 */
import net from 'node:net';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPART_DEMO, DESTINATIONS_DEMO } from '../../../client/src/lib/demoCotonou.js';

net.setDefaultAutoSelectFamilyAttemptTimeout(2500); // réseau lent (voir index.ts)

const OSRM = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const SORTIE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../client/src/data/packDemo.json');
const PAUSE_MS = 1000;

const points = [DEPART_DEMO, ...DESTINATIONS_DEMO].map((a) => ({ lat: a.lat, lng: a.lng }));
const coord = (p: { lat: number; lng: number }) => `${p.lng},${p.lat}`;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function appel<T>(chemin: string): Promise<T> {
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(`${OSRM}${chemin}`, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        const d = (await r.json()) as T & { code: string };
        if (d.code === 'Ok') return d;
        throw new Error(`OSRM ${d.code}`);
      }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (essai === 4) throw e;
      await dormir(2000 * essai);
    }
  }
  throw new Error('inaccessible');
}

async function main() {
  console.log(`▶ Matrice ${points.length}×${points.length} depuis ${OSRM}…`);
  const table = await appel<{ distances: number[][]; durations: number[][] }>(
    `/table/v1/driving/${points.map(coord).join(';')}?annotations=distance,duration`,
  );

  const n = points.length;
  const troncons: (string | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));
  let fait = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      await dormir(PAUSE_MS);
      const r = await appel<{ routes: { geometry: string }[] }>(
        `/route/v1/driving/${coord(points[i])};${coord(points[j])}?overview=full&geometries=polyline`,
      );
      troncons[i][j] = r.routes[0].geometry;
      fait++;
      if (fait % 30 === 0) console.log(`  ${fait}/${n * (n - 1)} tronçons`);
    }
  }

  const arrondir = (m: number[][]) => m.map((l) => l.map((v) => Math.round(v * 10) / 10));
  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(
    SORTIE,
    JSON.stringify({
      genereLe: new Date().toISOString(),
      source: OSRM,
      points,
      distances: arrondir(table.distances),
      durations: arrondir(table.durations),
      troncons,
    }),
  );
  console.log(`✔ Pack écrit : ${SORTIE}`);
}

main().catch((e) => {
  console.error('✖', e);
  process.exit(1);
});
