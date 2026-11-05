/**
 * Utilitaires HTTP : enveloppe async (capture des erreurs) et erreur applicative.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Erreur applicative portant un code HTTP et un message destiné à l'utilisateur. */
export class HttpError extends Error {
  constructor(
    public readonly statut: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Enveloppe un handler async et transmet toute erreur au middleware d'erreur. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
