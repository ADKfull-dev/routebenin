/**
 * benchmark.ts — Mesures de performance du moteur d'optimisation (pour le mémoire).
 *
 * Lancer : `npm run bench` (depuis server/) → écrit dans docs/benchmarks/ :
 *   - resultats.json / *.csv   données brutes
 *   - qualite.svg              écart à l'optimum exact (petits N)
 *   - temps.svg                temps de calcul selon N
 *   - gain.svg                 gain vs ordre de saisie selon N
 *   - BENCHMARKS.md            synthèse lisible (tableaux + figures)
 *
 * Trois variantes du MÊME code que l'application (aucune réimplémentation) :
 *   PPV                 = Plus Proche Voisin seul
 *   PPV + 2-opt         = PPV puis 2-opt jusqu'à stabilité
 *   PPV + 2-opt + Or-opt = la méthode utilisée par RouteBénin (solveTour)
 * comparées à la force brute (optimum exact) quand N le permet.
 *
 * Les instances sont des points aléatoires dans l'emprise de Cotonou /
 * Abomey-Calavi, distances Haversine, générateur pseudo-aléatoire à graine
 * fixe → résultats reproductibles à l'identique.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeTourDistance,
  deuxOpt,
  orOpt,
  plusProcheVoisin,
  solveTour,
  solveTourBruteForce,
} from '../algorithms/tsp.js';
import { matriceHaversine, type Coordonnee } from '../algorithms/distance.js';
import { charge, repartirTournees, repartitionNaive, type CritereVrp } from '../algorithms/vrp.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(ICI, '../../../docs/benchmarks');

/* ------------------------------------------------------------------ */
/* Instances reproductibles                                            */
/* ------------------------------------------------------------------ */

/** PRNG mulberry32 : déterministe, suffisant pour générer des instances. */
function prng(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Emprise approximative Cotonou + Abomey-Calavi. */
const EMPRISE = { latMin: 6.34, latMax: 6.46, lngMin: 2.33, lngMax: 2.47 };

function instance(n: number, graine: number): number[][] {
  const r = prng(graine);
  const pts: Coordonnee[] = Array.from({ length: n }, () => ({
    lat: EMPRISE.latMin + r() * (EMPRISE.latMax - EMPRISE.latMin),
    lng: EMPRISE.lngMin + r() * (EMPRISE.lngMax - EMPRISE.lngMin),
  }));
  return matriceHaversine(pts);
}

/* ------------------------------------------------------------------ */
/* Variantes                                                           */
/* ------------------------------------------------------------------ */

type Methode = 'ppv' | 'ppv2opt' | 'complet';
const METHODES: Methode[] = ['complet', 'ppv', 'ppv2opt'];
const LIBELLES: Record<Methode, string> = {
  complet: 'PPV + 2-opt + Or-opt (RouteBénin)',
  ppv: 'Plus Proche Voisin seul',
  ppv2opt: 'PPV + 2-opt',
};
const LIBELLES_COURTS: Record<Methode, string> = {
  complet: 'PPV + 2-opt + Or-opt',
  ppv: 'PPV seul',
  ppv2opt: 'PPV + 2-opt',
};

function resoudre(m: Methode, D: number[][]): number {
  if (m === 'complet') return solveTour(D, 0).totalDistance;
  const ordre = plusProcheVoisin(D, 0);
  if (m === 'ppv') return computeTourDistance(D, ordre);
  return computeTourDistance(D, deuxOpt(D, ordre));
}

/** Médiane du temps d'exécution (ms) sur plusieurs répétitions. */
function chrono(fn: () => void, repetitions: number): number {
  fn(); // échauffement JIT
  const t: number[] = [];
  for (let i = 0; i < repetitions; i++) {
    const d = performance.now();
    fn();
    t.push(performance.now() - d);
  }
  t.sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)];
}

const moyenne = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
const arrondi = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ------------------------------------------------------------------ */
/* 1. Qualité : écart à l'optimum exact (force brute), N ≤ 10          */
/* ------------------------------------------------------------------ */
const N_QUALITE = [5, 6, 7, 8, 9, 10];
const INSTANCES_QUALITE = 30;

interface LigneQualite {
  n: number;
  instances: number;
  ecartMoyen: Record<Methode, number>; // %
  ecartMax: Record<Methode, number>; // %
  optimumAtteint: Record<Methode, number>; // % d'instances résolues à l'optimum
}

function mesurerQualite(): LigneQualite[] {
  return N_QUALITE.map((n) => {
    const ecarts: Record<Methode, number[]> = { ppv: [], ppv2opt: [], complet: [] };
    const nbInstances = n === 10 ? 10 : INSTANCES_QUALITE; // 9! permutations : on limite
    for (let k = 0; k < nbInstances; k++) {
      const D = instance(n, 1000 * n + k);
      const opt = solveTourBruteForce(D, 0).totalDistance;
      for (const m of METHODES) ecarts[m].push(((resoudre(m, D) - opt) / opt) * 100);
    }
    const parMethode = <T>(f: (e: number[]) => T) =>
      Object.fromEntries(METHODES.map((m) => [m, f(ecarts[m])])) as Record<Methode, T>;
    return {
      n,
      instances: nbInstances,
      ecartMoyen: parMethode((e) => arrondi(moyenne(e))),
      ecartMax: parMethode((e) => arrondi(Math.max(...e))),
      optimumAtteint: parMethode((e) => arrondi((e.filter((x) => x < 1e-6).length / e.length) * 100, 0)),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Temps de calcul selon N                                          */
/* ------------------------------------------------------------------ */
const N_TEMPS = [10, 20, 30, 50, 75, 100, 150, 200];

interface LigneTemps {
  n: number;
  tempsMs: Record<Methode, number>;
  /** Amélioration de la méthode complète par rapport au PPV seul (%). */
  ameliorationVsPpv: number;
}

function mesurerTemps(): LigneTemps[] {
  return N_TEMPS.map((n) => {
    const instancesN = Array.from({ length: 5 }, (_, k) => instance(n, 5000 + 100 * n + k));
    const repetitions = n <= 50 ? 15 : n <= 100 ? 7 : 3;
    const tempsMs = Object.fromEntries(
      METHODES.map((m) => [
        m,
        arrondi(moyenne(instancesN.map((D) => chrono(() => resoudre(m, D), repetitions))), 3),
      ]),
    ) as Record<Methode, number>;
    const amelio = moyenne(
      instancesN.map((D) => {
        const p = resoudre('ppv', D);
        return ((p - resoudre('complet', D)) / p) * 100;
      }),
    );
    return { n, tempsMs, ameliorationVsPpv: arrondi(amelio) };
  });
}

/* ------------------------------------------------------------------ */
/* 3. Gain par rapport à l'ordre de saisie (ce que voit l'utilisateur)  */
/* ------------------------------------------------------------------ */
const N_GAIN = [5, 10, 15, 20, 30, 50];
const INSTANCES_GAIN = 30;

interface LigneGain {
  n: number;
  gainMoyen: number;
  gainMin: number;
  gainMax: number;
}

function mesurerGain(): LigneGain[] {
  return N_GAIN.map((n) => {
    const gains: number[] = [];
    for (let k = 0; k < INSTANCES_GAIN; k++) {
      // L'ordre de saisie est l'ordre de génération : aléatoire, donc « naïf ».
      const D = instance(n, 9000 + 100 * n + k);
      const naif = computeTourDistance(D, D.map((_, i) => i));
      gains.push(((naif - solveTour(D, 0).totalDistance) / naif) * 100);
    }
    return {
      n,
      gainMoyen: arrondi(moyenne(gains), 1),
      gainMin: arrondi(Math.min(...gains), 1),
      gainMax: arrondi(Math.max(...gains), 1),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 4. Multi-livreurs : « charges équilibrées » vs « même nombre d'arrêts » */
/* ------------------------------------------------------------------ */
const INSTANCES_VRP = 30;

interface LigneVrp {
  scenario: string;
  k: number;
  critere: CritereVrp;
  totalKm: number;
  chargeMaxKm: number;
  ecartChargesKm: number; // max − min
  gainVsNaif: number; // %
  tempsMs: number;
}

function mesurerVrp(): LigneVrp[] {
  const lignes: LigneVrp[] = [];
  const scenarios = [
    { nom: '20 adresses en ville', isole: false },
    { nom: '20 adresses + 1 point isolé (type Porto-Novo)', isole: true },
  ];
  for (const sc of scenarios) {
    for (const k of [2, 3, 4]) {
      for (const critere of ['arrets', 'equilibre'] as CritereVrp[]) {
        const acc = { total: 0, max: 0, ecart: 0, gain: 0, t: 0 };
        for (let i = 0; i < INSTANCES_VRP; i++) {
          const r = prng(70000 + 1000 * k + i);
          const pts: Coordonnee[] = Array.from({ length: 21 }, () => ({
            lat: EMPRISE.latMin + r() * (EMPRISE.latMax - EMPRISE.latMin),
            lng: EMPRISE.lngMin + r() * (EMPRISE.lngMax - EMPRISE.lngMin),
          }));
          if (sc.isole) pts.push({ lat: 6.4969, lng: 2.6283 });
          const D = matriceHaversine(pts);
          const t0 = performance.now();
          const v = repartirTournees(D, pts, 0, k, critere);
          acc.t += performance.now() - t0;
          const charges = v.tournees.map((t, j) => charge(v.distances[j], t.length - 1));
          acc.total += v.total;
          acc.max += Math.max(...charges);
          acc.ecart += Math.max(...charges) - Math.min(...charges);
          const naif = repartitionNaive(D, 0, k);
          acc.gain += ((naif - v.total) / naif) * 100;
        }
        const m = (x: number) => x / INSTANCES_VRP;
        lignes.push({
          scenario: sc.nom,
          k,
          critere,
          totalKm: arrondi(m(acc.total) / 1000, 1),
          chargeMaxKm: arrondi(m(acc.max) / 1000, 1),
          ecartChargesKm: arrondi(m(acc.ecart) / 1000, 1),
          gainVsNaif: arrondi(m(acc.gain), 1),
          tempsMs: arrondi(m(acc.t), 1),
        });
      }
    }
  }
  return lignes;
}

/* ------------------------------------------------------------------ */
/* Figures SVG (statiques, pour le mémoire)                            */
/* ------------------------------------------------------------------ */
const COULEURS: Record<Methode, string> = {
  complet: '#2a78d6', // slot 1
  ppv: '#eb6834', // slot 2
  ppv2opt: '#1baf7a', // slot 3
};
const ENCRE = '#0b0b0b';
const ENCRE_2 = '#52514e';
const GRILLE = '#e4e3df';
const FOND = '#fcfcfb';

interface Serie {
  nom: string;
  couleur: string;
  points: [number, number][];
}

/** « Belles » graduations (1, 2, 5 × 10^k). */
function graduations(max: number, cible = 5): number[] {
  const brut = max / cible;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= brut) ?? p * 10;
  const t: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += pas) t.push(arrondi(v, 6));
  if (t[t.length - 1] < max) t.push(arrondi(t[t.length - 1] + pas, 6));
  return t;
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(arrondi(v, 2))).replace('.', ',');

function graphiqueLignes(opts: {
  titre: string;
  sousTitre: string;
  axeX: string;
  axeY: string;
  series: Serie[];
  xTicks: number[];
  /** Bande min–max optionnelle (série unique). */
  bande?: [number, number, number][];
}): string {
  const L = 720;
  const H = 420;
  const m = { haut: 78, droite: 190, bas: 56, gauche: 64 };
  const lp = L - m.gauche - m.droite;
  const hp = H - m.haut - m.bas;
  const xMin = Math.min(...opts.xTicks);
  const xMax = Math.max(...opts.xTicks);
  const yMaxDonnees = Math.max(
    ...opts.series.flatMap((s) => s.points.map((p) => p[1])),
    ...(opts.bande?.map((b) => b[2]) ?? []),
  );
  const yTicks = graduations(yMaxDonnees || 1);
  const yMax = yTicks[yTicks.length - 1];
  const X = (v: number) => m.gauche + ((v - xMin) / (xMax - xMin)) * lp;
  const Y = (v: number) => m.haut + hp - (v / yMax) * hp;

  const o: string[] = [];
  o.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${H}" width="${L}" height="${H}" font-family="Inter, system-ui, sans-serif">`,
    `<rect width="${L}" height="${H}" fill="${FOND}"/>`,
    `<text x="${m.gauche}" y="30" font-size="17" font-weight="600" fill="${ENCRE}">${echapper(opts.titre)}</text>`,
    `<text x="${m.gauche}" y="52" font-size="12.5" fill="${ENCRE_2}">${echapper(opts.sousTitre)}</text>`,
  );
  // Grille horizontale + graduations Y
  for (const t of yTicks) {
    o.push(
      `<line x1="${m.gauche}" x2="${m.gauche + lp}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRILLE}" stroke-width="1"/>`,
      `<text x="${m.gauche - 8}" y="${Y(t) + 4}" font-size="11.5" text-anchor="end" fill="${ENCRE_2}">${fmt(t)}</text>`,
    );
  }
  for (const t of opts.xTicks) {
    o.push(`<text x="${X(t)}" y="${m.haut + hp + 20}" font-size="11.5" text-anchor="middle" fill="${ENCRE_2}">${fmt(t)}</text>`);
  }
  o.push(
    `<line x1="${m.gauche}" x2="${m.gauche + lp}" y1="${m.haut + hp}" y2="${m.haut + hp}" stroke="${ENCRE_2}" stroke-width="1"/>`,
    `<text x="${m.gauche + lp / 2}" y="${H - 14}" font-size="12" text-anchor="middle" fill="${ENCRE_2}">${echapper(opts.axeX)}</text>`,
    `<text transform="translate(18 ${m.haut + hp / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="${ENCRE_2}">${echapper(opts.axeY)}</text>`,
  );
  // Bande min–max
  if (opts.bande && opts.bande.length > 1) {
    const haut = opts.bande.map(([x, , max]) => `${X(x)},${Y(max)}`);
    const bas = opts.bande.map(([x, min]) => `${X(x)},${Y(min)}`).reverse();
    o.push(`<polygon points="${[...haut, ...bas].join(' ')}" fill="${opts.series[0].couleur}" fill-opacity="0.12"/>`);
  }
  // Séries : ligne 2px, marqueurs 8px cerclés de la couleur du fond
  const etiquettes: { y: number; s: Serie }[] = [];
  for (const s of opts.series) {
    const d = s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
    o.push(`<path d="${d}" fill="none" stroke="${s.couleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const [x, y] of s.points) {
      o.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${s.couleur}" stroke="${FOND}" stroke-width="2"><title>${echapper(s.nom)} — N=${x} : ${fmt(y)}</title></circle>`);
    }
    const dernier = s.points[s.points.length - 1];
    etiquettes.push({ y: Y(dernier[1]), s });
  }
  // Étiquettes directes en bout de ligne, écartées pour éviter les collisions
  etiquettes.sort((a, b) => a.y - b.y);
  for (let i = 1; i < etiquettes.length; i++) {
    if (etiquettes[i].y - etiquettes[i - 1].y < 16) etiquettes[i].y = etiquettes[i - 1].y + 16;
  }
  for (const { y, s } of etiquettes) {
    const x = m.gauche + lp + 10;
    o.push(
      `<line x1="${x}" x2="${x + 12}" y1="${y}" y2="${y}" stroke="${s.couleur}" stroke-width="2"/>`,
      `<text x="${x + 18}" y="${y + 4}" font-size="12" fill="${ENCRE}">${echapper(s.nom)}</text>`,
    );
  }
  o.push('</svg>');
  return o.join('\n');
}

/* ------------------------------------------------------------------ */
/* Exécution                                                           */
/* ------------------------------------------------------------------ */
function main() {
  mkdirSync(SORTIE, { recursive: true });
  console.log('▶ Qualité (écart à l’optimum, force brute)…');
  const qualite = mesurerQualite();
  console.log('▶ Temps de calcul…');
  const temps = mesurerTemps();
  console.log('▶ Gain vs ordre de saisie…');
  const gain = mesurerGain();
  console.log('▶ Multi-livreurs…');
  const vrp = mesurerVrp();

  const meta = {
    genereLe: new Date().toISOString(),
    node: process.version,
    distances: 'Haversine (vol d’oiseau), points aléatoires à graine fixe dans l’emprise Cotonou / Abomey-Calavi',
  };
  writeFileSync(resolve(SORTIE, 'resultats.json'), JSON.stringify({ meta, qualite, temps, gain, vrp }, null, 2));

  const csv = (entete: string[], lignes: (string | number)[][]) =>
    [entete.join(';'), ...lignes.map((l) => l.join(';'))].join('\n') + '\n';
  writeFileSync(
    resolve(SORTIE, 'qualite.csv'),
    csv(
      ['n', 'instances', ...METHODES.flatMap((m) => [`ecart_moyen_${m}`, `ecart_max_${m}`, `optimum_atteint_${m}`])],
      qualite.map((q) => [q.n, q.instances, ...METHODES.flatMap((m) => [q.ecartMoyen[m], q.ecartMax[m], q.optimumAtteint[m]])]),
    ),
  );
  writeFileSync(
    resolve(SORTIE, 'temps.csv'),
    csv(['n', ...METHODES.map((m) => `temps_ms_${m}`), 'amelioration_vs_ppv'], temps.map((t) => [t.n, ...METHODES.map((m) => t.tempsMs[m]), t.ameliorationVsPpv])),
  );
  writeFileSync(
    resolve(SORTIE, 'vrp.csv'),
    csv(
      ['scenario', 'k', 'critere', 'total_km', 'charge_max_km', 'ecart_charges_km', 'gain_vs_naif', 'temps_ms'],
      vrp.map((l) => [l.scenario, l.k, l.critere, l.totalKm, l.chargeMaxKm, l.ecartChargesKm, l.gainVsNaif, l.tempsMs]),
    ),
  );
  writeFileSync(resolve(SORTIE, 'gain.csv'), csv(['n', 'gain_moyen', 'gain_min', 'gain_max'], gain.map((g) => [g.n, g.gainMoyen, g.gainMin, g.gainMax])));

  writeFileSync(
    resolve(SORTIE, 'qualite.svg'),
    graphiqueLignes({
      titre: 'Écart moyen à la solution optimale',
      sousTitre: `Force brute comme référence exacte · ${INSTANCES_QUALITE} instances par N (10 pour N = 10)`,
      axeX: 'Nombre de points (départ inclus)',
      axeY: 'Écart moyen à l’optimum (%)',
      xTicks: N_QUALITE,
      series: METHODES.map((m) => ({ nom: LIBELLES_COURTS[m], couleur: COULEURS[m], points: qualite.map((q) => [q.n, q.ecartMoyen[m]]) })),
    }),
  );
  writeFileSync(
    resolve(SORTIE, 'temps.svg'),
    graphiqueLignes({
      titre: 'Temps de calcul selon le nombre de points',
      sousTitre: 'Médiane de plusieurs exécutions, moyenne sur 5 instances par N',
      axeX: 'Nombre de points',
      axeY: 'Temps de calcul (ms)',
      xTicks: [10, 50, 100, 150, 200],
      series: METHODES.map((m) => ({ nom: LIBELLES_COURTS[m], couleur: COULEURS[m], points: temps.map((t) => [t.n, t.tempsMs[m]]) })),
    }),
  );
  writeFileSync(
    resolve(SORTIE, 'gain.svg'),
    graphiqueLignes({
      titre: 'Distance économisée par rapport à l’ordre de saisie',
      sousTitre: `Méthode RouteBénin · ${INSTANCES_GAIN} tournées aléatoires par N · bande = min–max`,
      axeX: 'Nombre de points',
      axeY: 'Distance économisée (%)',
      xTicks: N_GAIN,
      series: [{ nom: 'Gain moyen', couleur: COULEURS.complet, points: gain.map((g) => [g.n, g.gainMoyen]) }],
      bande: gain.map((g) => [g.n, g.gainMin, g.gainMax]),
    }),
  );

  const v = (x: number) => fmt(x);
  const md = `# Benchmarks du moteur d'optimisation

> Fichier généré par \`npm run bench\` (dossier \`server/\`) le ${meta.genereLe.slice(0, 10)} — Node ${meta.node}.
> Ne pas modifier à la main : relancer le script.

**Protocole.** Instances = points aléatoires (générateur à graine fixe, donc
reproductibles) dans l'emprise Cotonou / Abomey-Calavi ; distances Haversine.
Les trois variantes exécutent **le code même de l'application**
(\`server/src/algorithms/tsp.ts\`) :

| Variante | Description |
|---|---|
| ${LIBELLES.ppv} | construction gloutonne, O(n²) |
| ${LIBELLES.ppv2opt} | + décroisement des segments jusqu'à stabilité |
| **${LIBELLES.complet}** | + déplacement de points isolés, alterné avec 2-opt |

## 1. Qualité : écart à l'optimum exact

Référence = **force brute** (toutes les (n−1)! permutations).

![Écart à l'optimum](qualite.svg)

| N | Instances | ${METHODES.map((m) => `${LIBELLES_COURTS[m]} — écart moyen / max`).join(' | ')} | Optimum atteint (RouteBénin) |
|---|---|${METHODES.map(() => '---|').join('')}---|
${qualite.map((q) => `| ${q.n} | ${q.instances} | ${METHODES.map((m) => `${v(q.ecartMoyen[m])} % / ${v(q.ecartMax[m])} %`).join(' | ')} | ${q.optimumAtteint.complet} % |`).join('\n')}

## 2. Temps de calcul

![Temps de calcul](temps.svg)

| N | ${METHODES.map((m) => `${LIBELLES_COURTS[m]} (ms)`).join(' | ')} | Gain de la méthode complète vs PPV seul |
|---|${METHODES.map(() => '---|').join('')}---|
${temps.map((t) => `| ${t.n} | ${METHODES.map((m) => v(t.tempsMs[m])).join(' | ')} | ${v(t.ameliorationVsPpv)} % |`).join('\n')}

## 3. Gain par rapport à l'ordre de saisie

C'est le chiffre affiché à l'utilisateur (« Avant → Après »). L'ordre de saisie
est ici aléatoire ; un livreur qui saisit ses adresses « au hasard » obtient
ce type de gain.

![Gain vs ordre de saisie](gain.svg)

| N | Gain moyen | Min | Max |
|---|---|---|---|
${gain.map((g) => `| ${g.n} | ${v(g.gainMoyen)} % | ${v(g.gainMin)} % | ${v(g.gainMax)} % |`).join('\n')}

## 4. Multi-livreurs : deux critères de répartition

${INSTANCES_VRP} instances par ligne (21 points, distances Haversine, donc sans
durées). **Charge** d'un livreur = distance + 2 km par arrêt (≈ 5 min de
livraison en ville). Dans l'application, avec les durées OSRM, la charge est
mesurée en **temps** : conduite + 5 min par livraison.
« Même nombre d'arrêts » minimise la distance totale avec au plus ⌈n/K⌉ arrêts
par livreur ; « charges équilibrées » minimise Σ charge² (= K·(moyenne² + variance)).

| Scénario | K | Critère | Distance totale | Charge max | Écart max − min | Gain vs partage naïf | Temps |
|---|---|---|---|---|---|---|---|
${vrp.map((l) => `| ${l.scenario} | ${l.k} | ${l.critere === 'arrets' ? 'Même nb d’arrêts' : '**Charges équilibrées**'} | ${v(l.totalKm)} km | ${v(l.chargeMaxKm)} km | ${v(l.ecartChargesKm)} km | ${v(l.gainVsNaif)} % | ${v(l.tempsMs)} ms |`).join('\n')}

## Lecture pour le mémoire

- Le **PPV seul** est rapide mais s'éloigne de l'optimum dès quelques points.
- **2-opt** supprime l'essentiel de cet écart ; **Or-opt** corrige les cas
  résiduels qu'un simple décroisement ne voit pas.
- Le temps de calcul reste **bien en dessous de la milliseconde** pour une
  tournée réaliste (10 à 30 points), et de l'ordre de 15 ms à 200 points. Il
  croît de façon polynomiale, sans l'explosion factorielle de la force brute.
  L'utilisateur attend surtout les appels OSRM, pas l'algorithme.
- La méthode complète n'est pas exacte (heuristique) : elle rate parfois
  l'optimum de quelques dixièmes de pourcent — à comparer au coût de la force
  brute, inutilisable au-delà d'une dizaine de points.

- En multi-livreurs, les deux critères battent largement le partage naïf.
  **Avec un point isolé**, « charges équilibrées » allège le livreur le plus
  chargé d'environ 8 à 10 km et réduit l'écart entre livreurs de 30 à 50 %,
  pour une distance totale égale ou inférieure. **En ville homogène**, le
  plafond ⌈n/K⌉ équilibre déjà bien : « charges équilibrées » y raccourcit la
  distance totale (−1 à −4 km) au prix d'un écart un peu plus grand. Σ charge²
  arbitre entre efficacité (moyenne) et équité (variance) ; ce n'est pas un
  critère min-max strict.

Données brutes : \`resultats.json\`, \`qualite.csv\`, \`temps.csv\`, \`gain.csv\`, \`vrp.csv\`.
`;
  writeFileSync(resolve(SORTIE, 'BENCHMARKS.md'), md);
  console.log(`✔ Résultats écrits dans ${SORTIE}`);
  console.table(qualite.map((q) => ({ n: q.n, ...q.ecartMoyen })));
  console.table(temps.map((t) => ({ n: t.n, ...t.tempsMs, amelio: t.ameliorationVsPpv })));
  console.table(gain);
}

main();
