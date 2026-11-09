import { afterEach, describe, expect, it, vi } from 'vitest';

// Deux serveurs : le principal (auto-hébergé) puis le secours.
process.env.OSRM_URL = 'http://principal.test';
process.env.OSRM_URL_SECOURS = 'http://secours.test';
const { matriceDistancesOSRM } = await import('./osrm.js');

const points = [
  { lat: 6.1, lng: 2.1 },
  { lat: 6.2, lng: 2.2 },
];
const reponseOk = { code: 'Ok', distances: [[0, 1], [1, 0]], durations: [[0, 2], [2, 0]] };

afterEach(() => vi.unstubAllGlobals());

describe('OSRM : serveur principal puis secours', () => {
  it('utilise le principal quand il répond', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(reponseOk)));
    vi.stubGlobal('fetch', f);
    await expect(matriceDistancesOSRM(points)).resolves.toEqual({ distances: reponseOk.distances, durations: reponseOk.durations });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('principal.test');
  });

  it('bascule sur le secours si le principal est injoignable', async () => {
    const f = vi.fn(async (url: URL) => {
      if (url.host === 'principal.test') throw new TypeError('fetch failed');
      return new Response(JSON.stringify(reponseOk));
    });
    vi.stubGlobal('fetch', f);
    await expect(matriceDistancesOSRM(points)).resolves.toMatchObject({ distances: reponseOk.distances });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('échoue si aucun serveur ne répond', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(matriceDistancesOSRM(points)).rejects.toThrow(/OSRM/);
  });
});
