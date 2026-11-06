/**
 * packDemo — données routières OSRM pré-calculées pour l'exemple de Cotonou
 * (généré par `npm run pack-demo` dans server/, fichier data/packDemo.json).
 *
 * Quand TOUS les points d'une demande appartiennent à l'exemple, la matrice
 * et les tracés sont lus dans le pack au lieu d'interroger le serveur OSRM
 * public : la démonstration reste rapide et fiable même si ce serveur est
 * saturé ou si le réseau est mauvais. Les données sont de vraies données OSRM.
 * Le pack est chargé à la demande (fichier séparé), jamais au démarrage.
 */
interface Pack {
  points: { lat: number; lng: number }[];
  distances: number[][];
  durations: number[][];
  /** troncons[i][j] : polyline encodée (précision 5) du trajet i → j. */
  troncons: (string | null)[][];
}

interface Point {
  lat: number;
  lng: number;
}

let chargement: Promise<Pack | null> | null = null;

function chargerPack(): Promise<Pack | null> {
  chargement ??= import('../data/packDemo.json')
    .then((m) => m.default as unknown as Pack)
    .catch(() => null);
  return chargement;
}

/** Indices des points dans le pack, ou null si l'un d'eux n'y figure pas. */
function indices(pack: Pack, points: Point[]): number[] | null {
  const res: number[] = [];
  for (const p of points) {
    const i = pack.points.findIndex((q) => Math.abs(q.lat - p.lat) < 1e-6 && Math.abs(q.lng - p.lng) < 1e-6);
    if (i < 0) return null;
    res.push(i);
  }
  return res;
}

/** Décode une polyline Google/OSRM (précision 5) en [lng, lat] (format GeoJSON). */
export function decoderPolyline(code: string): [number, number][] {
  const res: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const suivant = () => {
    let resultat = 0;
    let decalage = 0;
    let octet: number;
    do {
      octet = code.charCodeAt(i++) - 63;
      resultat |= (octet & 0x1f) << decalage;
      decalage += 5;
    } while (octet >= 0x20);
    return resultat & 1 ? ~(resultat >> 1) : resultat >> 1;
  };
  while (i < code.length) {
    lat += suivant();
    lng += suivant();
    res.push([lng / 1e5, lat / 1e5]);
  }
  return res;
}

/** Matrices distances/durées depuis le pack, ou null si hors exemple. */
export async function matriceDepuisPack(points: Point[]) {
  const pack = await chargerPack();
  const idx = pack && indices(pack, points);
  if (!pack || !idx) return null;
  return {
    distances: idx.map((i) => idx.map((j) => pack.distances[i][j])),
    durations: idx.map((i) => idx.map((j) => pack.durations[i][j])),
  };
}

/** Tracé [lng, lat] d'un parcours (ordre donné) depuis le pack, ou null si hors exemple. */
export async function traceDepuisPack(points: Point[]): Promise<[number, number][] | null> {
  const pack = await chargerPack();
  const idx = pack && indices(pack, points);
  if (!pack || !idx) return null;
  const trace: [number, number][] = [];
  for (let k = 0; k < idx.length - 1; k++) {
    if (idx[k] === idx[k + 1]) continue;
    const code = pack.troncons[idx[k]][idx[k + 1]];
    if (!code) return null;
    const morceau = decoderPolyline(code);
    trace.push(...(trace.length ? morceau.slice(1) : morceau));
  }
  return trace.length > 1 ? trace : null;
}
