/** Tests de la répartition multi-livreurs (VRP). */
import { describe, it, expect } from 'vitest';
import { repartirTournees, repartitionNaive, taillesEquilibrees, charge, coutRepartition, COUT_ARRET_S } from './vrp';
import { matriceHaversine, type Coordonnee } from './distance';

function points(n: number, graine = 7): Coordonnee[] {
  let s = graine;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: n }, () => ({ lat: 6.34 + r() * 0.12, lng: 2.33 + r() * 0.14 }));
}

describe('taillesEquilibrees', () => {
  it('répartit le reste sur les premiers groupes', () => {
    expect(taillesEquilibrees(10, 3)).toEqual([4, 3, 3]);
    expect(taillesEquilibrees(6, 3)).toEqual([2, 2, 2]);
  });
});

describe('repartirTournees', () => {
  it('chaque destination est visitée exactement une fois, toutes les tournées partent du dépôt', () => {
    const P = points(21);
    const D = matriceHaversine(P);
    for (const k of [1, 2, 3, 4, 6]) {
      const r = repartirTournees(D, P, 0, k);
      expect(r.tournees).toHaveLength(k);
      for (const t of r.tournees) expect(t[0]).toBe(0);
      const vus = r.tournees.flatMap((t) => t.slice(1)).sort((a, b) => a - b);
      expect(vus).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    }
  });

  it('critère « arrets » : au plus ⌈n/k⌉ arrêts par livreur', () => {
    const P = points(23, 3);
    const D = matriceHaversine(P);
    const r = repartirTournees(D, P, 0, 4, 'arrets');
    for (const t of r.tournees) expect(t.length - 1).toBeLessThanOrEqual(Math.ceil(22 / 4));
  });

  it('borne k au nombre de destinations', () => {
    const P = points(4);
    const r = repartirTournees(matriceHaversine(P), P, 0, 10);
    expect(r.tournees).toHaveLength(3);
  });

  it('fait mieux que la répartition naïve (ordre de saisie), quel que soit le critère', () => {
    for (const graine of [1, 2, 3, 4, 5]) {
      const P = points(25, graine);
      const D = matriceHaversine(P);
      for (const c of ['equilibre', 'arrets'] as const) {
        expect(repartirTournees(D, P, 0, 3, c).total).toBeLessThan(repartitionNaive(D, 0, 3));
      }
    }
  });

  it('critère « equilibre » : chaque livreur garde au moins un arrêt', () => {
    for (const graine of [1, 2, 3]) {
      const P = points(12, graine);
      const r = repartirTournees(matriceHaversine(P), P, 0, 5, 'equilibre');
      for (const t of r.tournees) expect(t.length).toBeGreaterThan(1);
    }
  });

  it('critère « equilibre » : réduit la charge du livreur le plus chargé quand un point est isolé', () => {
    // Un point très éloigné (type Porto-Novo depuis Cotonou) : avec « même
    // nombre d'arrêts », son livreur cumule le trajet lointain et des arrêts.
    let mieux = 0;
    for (const graine of [1, 2, 3, 4, 5, 6]) {
      const P = [...points(16, graine), { lat: 6.5, lng: 2.63 }];
      const D = matriceHaversine(P);
      const chargeMax = (c: 'equilibre' | 'arrets') => {
        const r = repartirTournees(D, P, 0, 3, c);
        return Math.max(...r.tournees.map((t, i) => charge(r.distances[i], t.length - 1)));
      };
      const [eq, ar] = [chargeMax('equilibre'), chargeMax('arrets')];
      expect(eq).toBeLessThanOrEqual(ar + 1e-6);
      if (eq < ar - 1) mieux++;
    }
    expect(mieux).toBeGreaterThan(0);
  });

  it('total = somme des distances par tournée', () => {
    const P = points(15);
    const r = repartirTournees(matriceHaversine(P), P, 0, 3);
    expect(r.total).toBeCloseTo(r.distances.reduce((s, d) => s + d, 0), 6);
  });

  it('reste rapide (50 points, 5 livreurs)', () => {
    const P = points(51, 11);
    const D = matriceHaversine(P);
    const t0 = performance.now();
    repartirTournees(D, P, 0, 5);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('avec les durées : équilibre le TEMPS de travail (conduite + 5 min/arrêt)', () => {
    // Point isolé relié par une voie rapide (70 km/h), le reste en ville (25 km/h).
    for (const graine of [1, 2, 3, 4]) {
      const P = [...points(16, graine), { lat: 6.5, lng: 2.63 }];
      const D = matriceHaversine(P);
      const iso = P.length - 1;
      const T = D.map((l, i) => l.map((d, j) => d / ((i === iso || j === iso ? 70 : 25) / 3.6)));
      // Critère en temps : Σ (conduite + 5 min × arrêts)²
      const critereTemps = (r: ReturnType<typeof repartirTournees>) =>
        coutRepartition(
          r.tournees.map((t) => {
            let s = 0;
            for (let i = 0; i < t.length; i++) s += T[t[i]][t[(i + 1) % t.length]];
            return s;
          }),
          r.tournees.map((t) => t.length - 1),
          'equilibre',
          COUT_ARRET_S,
        );
      const avecDurees = repartirTournees(D, P, 0, 3, 'equilibre', { durees: T });
      const parArrets = repartirTournees(D, P, 0, 3, 'arrets');
      // Garanti par construction : la recherche repart aussi de la solution « arrets ».
      expect(critereTemps(avecDurees)).toBeLessThanOrEqual(critereTemps(parArrets) + 1e-9);
      // Les distances renvoyées restent des distances (mètres), pas des durées.
      expect(avecDurees.total).toBeGreaterThan(1000);
    }
  });
});
