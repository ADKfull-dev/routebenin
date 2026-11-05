/**
 * Contrôleur de géocodage : recherche d'adresses (autocomplétion).
 */
import type { Request, Response } from 'express';
import { geocoder, ServiceIndisponibleError } from '../services/nominatim.js';
import { HttpError } from '../lib/http.js';

export async function rechercherAdresse(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limite = Math.min(10, Math.max(1, Number(req.query.limit) || 5));

  if (q.trim().length < 3) {
    res.json({ resultats: [] });
    return;
  }

  try {
    const resultats = await geocoder(q, limite);
    res.json({ resultats });
  } catch (e) {
    if (e instanceof ServiceIndisponibleError) {
      throw new HttpError(503, e.message);
    }
    throw e;
  }
}
