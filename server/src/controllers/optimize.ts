/**
 * Contrôleur d'optimisation : reçoit une tournée, renvoie l'ordre optimal.
 */
import type { Request, Response } from 'express';
import { optimizeSchema } from '../lib/validation.js';
import { optimiserTournee, EntreeInvalideError } from '../services/optimisation.js';
import { HttpError } from '../lib/http.js';

export async function optimiser(req: Request, res: Response): Promise<void> {
  const parse = optimizeSchema.safeParse(req.body);
  if (!parse.success) {
    const premier = parse.error.issues[0];
    throw new HttpError(400, premier?.message ?? 'Données de tournée invalides.');
  }

  try {
    const resultat = await optimiserTournee(parse.data);
    res.json({ resultat });
  } catch (e) {
    if (e instanceof EntreeInvalideError) {
      throw new HttpError(400, e.message);
    }
    throw e;
  }
}
