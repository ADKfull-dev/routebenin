/** Tests de la répartition multi-livreurs (VRP). */
import { describe, it, expect } from 'vitest';
import { repartirTournees, repartitionNaive, taillesEquilibrees } from './vrp';
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

  it('respecte la charge maximale ⌈n/k⌉', () => {
    const P = points(23, 3);
    const D = matriceHaversine(P);
    const r = repartirTournees(D, P, 0, 4);
    for (const t of r.tournees) expect(t.length - 1).toBeLessThanOrEqual(Math.ceil(22 / 4));
  });

  it('borne k au nombre de destinations', () => {
    const P = points(4);
    const r = repartirTournees(matriceHaversine(P), P, 0, 10);
    expect(r.tournees).toHaveLength(3);
  });

  it('fait mieux que la répartition naïve (ordre de saisie)', () => {
    for (const graine of [1, 2, 3, 4, 5]) {
      const P = points(25, graine);
      const D = matriceHaversine(P);
      const r = repartirTournees(D, P, 0, 3);
      expect(r.total).toBeLessThan(repartitionNaive(D, 0, 3));
    }
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
});
