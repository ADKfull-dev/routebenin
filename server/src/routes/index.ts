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
import {
  ajouterMembre,
  changerMotDePasse,
  connexion,
  deconnexion,
  etatSession,
  inscription,
  listerEquipe,
  retirerMembre,
} from '../controllers/comptes.js';
import { exigerSession } from '../lib/auth.js';

export const apiRouter = Router();

// Comptes (publics : avant le contrôle de session)
apiRouter.get('/auth/etat', asyncHandler(etatSession));
apiRouter.post('/auth/inscription', asyncHandler(inscription));
apiRouter.post('/auth/connexion', asyncHandler(connexion));
apiRouter.post('/auth/deconnexion', asyncHandler(deconnexion));

// Tout le reste : session obligatoire en mode comptes (COMPTES=oui).
apiRouter.use(asyncHandler(exigerSession));

apiRouter.put('/auth/mot-de-passe', asyncHandler(changerMotDePasse));
apiRouter.get('/equipe', asyncHandler(listerEquipe));
apiRouter.post('/equipe', asyncHandler(ajouterMembre));
apiRouter.delete('/equipe/:id', asyncHandler(retirerMembre));

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
