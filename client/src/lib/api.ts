/**
 * api — point d'entrée unique pour l'accès aux données.
 *
 * Deux implémentations possibles, choisies à la compilation :
 *  - mode statique (VITE_STATIC=true, ex. GitHub Pages) : tout en navigateur ;
 *  - mode full-stack (défaut) : requêtes vers le backend Express via /api.
 */
import { serverApi } from './serverApi';
import { localApi } from './localApi';
import type { ApiClient } from './apiTypes';

const MODE_STATIQUE = import.meta.env.VITE_STATIC === 'true';

export const api: ApiClient = MODE_STATIQUE ? localApi : serverApi;

export { ApiError } from './apiTypes';
export type {
  EntreeOptimisation,
  StatsDashboard,
  ResumeTournee,
  Profil,
} from './apiTypes';
