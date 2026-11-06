/**
 * packDemo.ts — Lecture côté serveur du « pack démo » (données OSRM réelles
 * pré-calculées pour l'exemple de Cotonou, voir src/tools/packDemo.ts).
 *
 * Si tous les points d'une requête appartiennent à l'exemple, on répond depuis
 * le pack sans appeler OSRM : démonstration rapide et indépendante du réseau.
 * Absent ou illisible → null, et l'appelant interroge OSRM normalement.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Coordonnee } from '../algorithms/distance.js';

interface Pack {
  points: Coordonnee[];
  distances: number[][];
  durations: number[][];
  troncons: (string | null)[][];
}

const CHEMIN = resolve(dirname(fileURLToPath(import.meta.url)), '../../../client/src/data/packDemo.json');

let pack: Pack | null | undefined;
function lirePack(): Pack | null {
  if (pack === undefined) {
    try {
      pack = JSON.parse(readFileSync(CHEMIN, 'utf8')) as Pack;
    } catch {
      pack = null;
    }
  }
  return pack;
}

function indices(p: Pack, points: Coordonnee[]): number[] | null {
  const res: number[] = [];
  for (const q of points) {
    const i = p.points.findIndex((r) => Math.abs(r.lat - q.lat) < 1e-6 && Math.abs(r.lng - q.lng) < 1e-6);
    if (i < 0) return null;
    res.push(i);
  }
  return res;
}

/** Décode une polyline (précision 5) en [lng, lat]. */
function decoder(code: string): [number, number][] {
  const res: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const suivant = () => {
    let r = 0;
    let d = 0;
    let o: number;
    do {
      o = code.charCodeAt(i++) - 63;
      r |= (o & 0x1f) << d;
      d += 5;
    } while (o >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < code.length) {
    lat += suivant();
    lng += suivant();
    res.push([lng / 1e5, lat / 1e5]);
  }
  return res;
}

export function matriceDepuisPack(points: Coordonnee[]): { distances: number[][]; durations: number[][] } | null {
  const p = lirePack();
  const idx = p && indices(p, points);
  if (!p || !idx) return null;
  return {
    distances: idx.map((i) => idx.map((j) => p.distances[i][j])),
    durations: idx.map((i) => idx.map((j) => p.durations[i][j])),
  };
}

export function traceDepuisPack(
  points: Coordonnee[],
): { geometrie: [number, number][]; distance: number; duree: number } | null {
  const p = lirePack();
  const idx = p && indices(p, points);
  if (!p || !idx) return null;
  const geometrie: [number, number][] = [];
  let distance = 0;
  let duree = 0;
  for (let k = 0; k < idx.length - 1; k++) {
    const [a, b] = [idx[k], idx[k + 1]];
    if (a === b) continue;
    const code = p.troncons[a][b];
    if (!code) return null;
    const morceau = decoder(code);
    geometrie.push(...(geometrie.length ? morceau.slice(1) : morceau));
    distance += p.distances[a][b];
    duree += p.durations[a][b];
  }
  return geometrie.length > 1 ? { geometrie, distance, duree } : null;
}
