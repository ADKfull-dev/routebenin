/**
 * Tests du moteur d'optimisation (Vitest).
 * On vérifie la validité de la tournée, les cas limites, la non-régression
 * (le résultat n'est jamais pire que l'ordre de saisie) et l'optimalité
 * (comparaison à la force brute sur de petits cas).
 */
import { describe, it, expect } from 'vitest';
import {
  solveTour,
  solveTourBruteForce,
  computeTourDistance,
  MatriceInvalideError,
} from './tsp';
import { matriceHaversine, type Coordonnee } from './distance';

/** Génère une matrice symétrique aléatoire de taille n (distances 1..100). */
function matriceAleatoire(n: number, seed = 1): number[][] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = 1 + Math.floor(rnd() * 100);
      m[i][j] = d;
      m[j][i] = d;
    }
  return m;
}

/** Vérifie qu'un ordre est une permutation valide de [0..n-1] partant de `start`. */
function estPermutationValide(order: number[], n: number, start: number): boolean {
  if (order.length !== n) return false;
  if (order[0] !== start) return false;
  const vus = new Set(order);
  if (vus.size !== n) return false;
  for (let i = 0; i < n; i++) if (!vus.has(i)) return false;
  return true;
}

describe('computeTourDistance', () => {
  it('additionne les arêtes et le retour au départ', () => {
    const m = [
      [0, 10, 20],
      [10, 0, 15],
      [20, 15, 0],
    ];
    // 0 -> 1 -> 2 -> 0 = 10 + 15 + 20 = 45
    expect(computeTourDistance(m, [0, 1, 2])).toBe(45);
  });

  it('renvoie 0 pour 0 ou 1 point', () => {
    expect(computeTourDistance([[0]], [0])).toBe(0);
    expect(computeTourDistance([], [])).toBe(0);
  });
});

describe('solveTour — cas limites', () => {
  it('1 point', () => {
    const r = solveTour([[0]], 0);
    expect(r.order).toEqual([0]);
    expect(r.totalDistance).toBe(0);
  });

  it('2 points', () => {
    const m = [
      [0, 7],
      [7, 0],
    ];
    const r = solveTour(m, 0);
    expect(r.order).toEqual([0, 1]);
    expect(r.totalDistance).toBe(14); // aller-retour
  });

  it('3 points — toutes les tournées sont équivalentes en longueur', () => {
    const m = [
      [0, 5, 9],
      [5, 0, 6],
      [9, 6, 0],
    ];
    const r = solveTour(m, 0);
    expect(estPermutationValide(r.order, 3, 0)).toBe(true);
    expect(r.totalDistance).toBe(20);
  });

  it('matrice avec distances nulles (points dupliqués)', () => {
    const m = [
      [0, 0, 5],
      [0, 0, 5],
      [5, 5, 0],
    ];
    const r = solveTour(m, 0);
    expect(estPermutationValide(r.order, 3, 0)).toBe(true);
    expect(Number.isFinite(r.totalDistance)).toBe(true);
  });

  it('respecte le point de départ demandé', () => {
    const m = matriceAleatoire(7, 42);
    for (let start = 0; start < 7; start++) {
      const r = solveTour(m, start);
      expect(r.order[0]).toBe(start);
    }
  });

  it('lève une erreur sur matrice invalide', () => {
    expect(() => solveTour([], 0)).toThrow(MatriceInvalideError);
    expect(() => solveTour([[0, 1]], 0)).toThrow(MatriceInvalideError);
    expect(() => solveTour([[0]], 5)).toThrow(MatriceInvalideError);
  });
});

describe('solveTour — validité et non-régression', () => {
  it('produit toujours une permutation valide (n = 4..30)', () => {
    for (let n = 4; n <= 30; n++) {
      const m = matriceAleatoire(n, n * 7 + 1);
      const r = solveTour(m, 0);
      expect(estPermutationValide(r.order, n, 0)).toBe(true);
    }
  });

  it('n’est jamais pire que l’ordre de saisie', () => {
    for (let n = 4; n <= 25; n++) {
      const m = matriceAleatoire(n, n * 13 + 3);
      const ordreSaisie = Array.from({ length: n }, (_, i) => i);
      const avant = computeTourDistance(m, ordreSaisie);
      const r = solveTour(m, 0);
      expect(r.totalDistance).toBeLessThanOrEqual(avant + 1e-6);
    }
  });
});

describe('solveTour — optimalité (vs force brute, petits cas)', () => {
  it('trouve souvent l’optimum et reste très proche sinon (n ≤ 8)', () => {
    for (let n = 4; n <= 8; n++) {
      for (let seed = 1; seed <= 5; seed++) {
        const m = matriceAleatoire(n, n * 100 + seed);
        const approx = solveTour(m, 0);
        const exact = solveTourBruteForce(m, 0);
        // La solution NN+2-opt doit rester dans une marge raisonnable de l'optimum.
        expect(approx.totalDistance).toBeLessThanOrEqual(exact.totalDistance * 1.15 + 1e-6);
        expect(approx.totalDistance).toBeGreaterThanOrEqual(exact.totalDistance - 1e-6);
      }
    }
  });
});

describe('intégration avec Haversine', () => {
  it('optimise une petite tournée géographique à Cotonou', () => {
    const points: Coordonnee[] = [
      { lat: 6.3703, lng: 2.3912 }, // Ganhi (départ)
      { lat: 6.3654, lng: 2.4183 }, // Akpakpa
      { lat: 6.3899, lng: 2.3487 }, // Fidjrossè
      { lat: 6.3528, lng: 2.3792 }, // Dantokpa
    ];
    const m = matriceHaversine(points);
    const r = solveTour(m, 0);
    expect(estPermutationValide(r.order, 4, 0)).toBe(true);
    expect(r.totalDistance).toBeGreaterThan(0);
  });
});

describe('performance', () => {
  it('résout 50 points en moins de 2 secondes', () => {
    const m = matriceAleatoire(50, 777);
    const t0 = Date.now();
    const r = solveTour(m, 0);
    const dt = Date.now() - t0;
    expect(estPermutationValide(r.order, 50, 0)).toBe(true);
    expect(dt).toBeLessThan(2000);
  });
});
