/**
 * Agrégateur des routes de l'API (toutes préfixées par /api dans index.ts).
 */
import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { rechercherAdresse } from '../controllers/geocode.js';
import { optimiser } from '../controllers/optimize.js';
import {
  listerTournees,
  obtenirTournee,
  sauvegarderTournee,
  supprimerTournee,
  statistiques,
} from '../controllers/tournees.js';
import { obtenirProfil, mettreAJourProfil } from '../controllers/profil.js';

export const apiRouter = Router();

// Géocodage
apiRouter.get('/geocode', asyncHandler(rechercherAdresse));

// Optimisation (cœur du produit)
apiRouter.post('/optimize', asyncHandler(optimiser));

// Statistiques du tableau de bord
apiRouter.get('/stats', asyncHandler(statistiques));

// Historique des tournées
apiRouter.get('/tournees', asyncHandler(listerTournees));
apiRouter.get('/tournees/:id', asyncHandler(obtenirTournee));
apiRouter.post('/tournees', asyncHandler(sauvegarderTournee));
apiRouter.delete('/tournees/:id', asyncHandler(supprimerTournee));

// Profil / paramètres
apiRouter.get('/profil', asyncHandler(obtenirProfil));
apiRouter.put('/profil', asyncHandler(mettreAJourProfil));
