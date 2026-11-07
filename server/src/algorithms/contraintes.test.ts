/** Tests des tournées avec fenêtres horaires et capacité. */
import { describe, it, expect } from 'vitest';
import {
  simuler,
  ordonnerAvecFenetres,
  repartirAvecContraintes,
  heureEnSecondes,
  meilleur,
  dureesDepuisDistances,
  type Contraintes,
} from './contraintes';
import { matriceHaversine, type Coordonnee } from './distance';
import { solveTour } from './tsp';

function points(n: number, graine = 7): Coordonnee[] {
  let s = graine;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: n }, () => ({ lat: 6.34 + r() * 0.12, lng: 2.33 + r() * 0.14 }));
}

const H = (h: string) => heureEnSecondes(h)!;

function contraintes(n: number, D: number[][], extra: Partial<Contraintes> = {}): Contraintes {
  return {
    durees: dureesDepuisDistances(D),
    heureDepart: H('08:00'),
    service: 300,
    fenetres: new Array(n).fill(null),
    demandes: [0, ...new Array(n - 1).fill(1)],
    capacite: null,
    ...extra,
  };
}

describe('heureEnSecondes', () => {
  it('convertit HH:MM et rejette le reste', () => {
    expect(heureEnSecondes('08:30')).toBe(8 * 3600 + 30 * 60);
    expect(heureEnSecondes('7:05')).toBe(7 * 3600 + 5 * 60);
    expect(heureEnSecondes('24:00')).toBeNull();
    expect(heureEnSecondes('')).toBeNull();
    expect(heureEnSecondes('midi')).toBeNull();
  });
});

describe('meilleur (ordre lexicographique)', () => {
  it('le premier critère prime', () => {
    expect(meilleur([0, 999], [1, 0])).toBe(true);
    expect(meilleur([1, 0], [0, 999])).toBe(false);
    expect(meilleur([0, 5], [0, 6])).toBe(true);
    expect(meilleur([0, 5], [0, 5])).toBe(false);
  });
});

describe('simuler', () => {
  // 0 = dépôt ; trajets de 10 min entre tous les points.
  const T = [
    [0, 600, 600],
    [600, 0, 600],
    [600, 600, 0],
  ];
  const base: Contraintes = {
    durees: T,
    heureDepart: H('08:00'),
    service: 300,
    fenetres: [null, null, null],
    demandes: [0, 2, 3],
    capacite: null,
  };
  it('enchaîne trajets et temps sur place', () => {
    const s = simuler([0, 1, 2], 0, base);
    expect(s.passages.map((p) => p.arrivee)).toEqual([H('08:10'), H('08:25')]);
    expect(s.heureFin).toBe(H('08:40'));
    expect(s.charge).toBe(5);
    expect(s.conduite).toBe(1800);
    expect(s.retardTotal).toBe(0);
  });
  it('attend l’ouverture de la fenêtre et compte les retards', () => {
    const c = { ...base, fenetres: [null, { debut: H('09:00'), fin: null }, { debut: null, fin: H('09:00') }] };
    const s = simuler([0, 1, 2], 0, c);
    expect(s.passages[0].attente).toBe(50 * 60); // arrivé 08:10, ouvre à 09:00
    expect(s.passages[1].arrivee).toBe(H('09:15')); // 09:00 + 5 min + 10 min
    expect(s.passages[1].retard).toBe(15 * 60);
    expect(s.nombreRetards).toBe(1);
  });
});

describe('ordonnerAvecFenetres', () => {
  it('sans fenêtre : aussi court que le moteur TSP', () => {
    const P = points(12);
    const D = matriceHaversine(P);
    const c = contraintes(P.length, D);
    const arrets = P.map((_, i) => i).slice(1);
    const r = ordonnerAvecFenetres(D, 0, arrets, 0, c);
    const dist = (o: number[]) => o.reduce((s, x, i) => s + D[x][o[(i + 1) % o.length]], 0);
    expect(dist(r)).toBeLessThanOrEqual(solveTour(D, 0).totalDistance + 1e-6);
    expect(r.slice().sort((a, b) => a - b)).toEqual(P.map((_, i) => i));
  });

  it('respecte une fenêtre serrée, quitte à rallonger', () => {
    for (const graine of [1, 2, 3, 4, 5]) {
      const P = points(10, graine);
      const D = matriceHaversine(P);
      const c = contraintes(P.length, D);
      const ordreCourt = solveTour(D, 0).order;
      // La DERNIÈRE livraison de l'ordre le plus court doit être faite avant 08:20.
      const urgent = ordreCourt[ordreCourt.length - 1];
      c.fenetres[urgent] = { debut: null, fin: H('08:20') };
      const r = ordonnerAvecFenetres(D, 0, ordreCourt.slice(1), 0, c);
      const s = simuler(r, 0, c);
      expect(s.retardTotal).toBe(0);
      expect(r.indexOf(urgent)).toBeLessThan(r.length - 1);
    }
  });

  it('fenêtres incompatibles : minimise le retard sans planter', () => {
    const P = points(6, 9);
    const D = matriceHaversine(P);
    const c = contraintes(P.length, D);
    for (let i = 1; i < P.length; i++) c.fenetres[i] = { debut: null, fin: H('08:05') };
    const r = ordonnerAvecFenetres(D, 0, [1, 2, 3, 4, 5], 0, c);
    expect(r).toHaveLength(6);
    expect(simuler(r, 0, c).nombreRetards).toBeGreaterThan(0);
  });

  it('arrivée distincte : elle reste à la fin', () => {
    const P = points(8, 4);
    const D = matriceHaversine(P);
    const c = contraintes(P.length, D);
    const fin = P.length - 1;
    const r = ordonnerAvecFenetres(D, 0, [1, 2, 3, 4, 5, 6], fin, c);
    expect(r[0]).toBe(0);
    expect(r).not.toContain(fin);
    expect(r).toHaveLength(7);
  });
});

describe('repartirAvecContraintes', () => {
  it('respecte la capacité quand c’est possible', () => {
    for (const graine of [1, 2, 3]) {
      const P = points(16, graine);
      const D = matriceHaversine(P);
      // 15 livraisons, colis 1 à 3 : total ≤ 45 ; 3 livreurs de capacité 16.
      const demandes = [0, ...Array.from({ length: 15 }, (_, i) => 1 + ((i * 7 + graine) % 3))];
      const total = demandes.reduce((a, b) => a + b, 0);
      const capacite = Math.ceil(total / 3) + 1;
      const c = contraintes(P.length, D, { demandes, capacite });
      const r = repartirAvecContraintes(D, P, 0, 3, 'equilibre', c);
      for (const s of r.simulations) expect(s.charge).toBeLessThanOrEqual(capacite);
      const visites = r.tournees.flatMap((t) => t.slice(1)).sort((a, b) => a - b);
      expect(visites).toEqual(P.map((_, i) => i).slice(1));
      for (const t of r.tournees) expect(t[0]).toBe(0);
    }
  });

  it('aucun retard quand les fenêtres sont larges, et réduit les retards sinon', () => {
    const P = points(13, 6);
    const D = matriceHaversine(P);
    const c = contraintes(P.length, D);
    // Moitié des clients le matin tôt, moitié l'après-midi.
    for (let i = 1; i < P.length; i++) {
      c.fenetres[i] = i % 2 ? { debut: null, fin: H('09:00') } : { debut: H('14:00'), fin: H('17:00') };
    }
    const r = repartirAvecContraintes(D, P, 0, 3, 'equilibre', c);
    const retard = r.simulations.reduce((s, x) => s + x.retardTotal, 0);
    expect(retard).toBe(0);
  });

  it('reste rapide (40 livraisons, 4 livreurs, fenêtres et capacité)', () => {
    const P = points(41, 3);
    const D = matriceHaversine(P);
    const c = contraintes(P.length, D, { capacite: 11 });
    for (let i = 1; i < P.length; i += 3) c.fenetres[i] = { debut: H('09:00'), fin: H('11:00') };
    const debut = performance.now();
    repartirAvecContraintes(D, P, 0, 4, 'equilibre', c);
    expect(performance.now() - debut).toBeLessThan(5000);
  });
});

describe('vitesseRepli (estimation sans OSRM)', () => {
  it('25 km/h en ville, 65 km/h entre villes, durée croissante avec la distance', async () => {
    const { vitesseRepli } = await import('./contraintes');
    expect(vitesseRepli(1000) * 3.6).toBeCloseTo(25);
    expect(vitesseRepli(100_000) * 3.6).toBeCloseTo(65);
    let precedente = 0;
    for (let d = 100; d <= 500_000; d += 500) {
      const duree = d / vitesseRepli(d);
      expect(duree).toBeGreaterThan(precedente);
      precedente = duree;
    }
    // Cotonou–Parakou (~415 km) : environ 6 h 20, et non 17 h.
    expect(415_000 / vitesseRepli(415_000) / 3600).toBeLessThan(7);
  });
});
