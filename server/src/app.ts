/**
 * Application Express de RouteBénin (sans écoute réseau : voir index.ts ;
 * les tests l'instancient directement).
 */
import net from 'node:net';
import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { env } from './lib/env.js';
import { apiRouter } from './routes/index.js';
import { HttpError } from './lib/http.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Node essaie IPv6 puis IPv4 avec seulement 250 ms par tentative (« happy
// eyeballs »). Sur une connexion lente (mobile, Afrique de l'Ouest), toutes les
// tentatives échouent et OSRM/Nominatim paraissent « injoignables ». On laisse
// 2,5 s par adresse.
net.setDefaultAutoSelectFamilyAttemptTimeout(2500);

export const app = express();

// Derrière un proxy https (Caddy, Nginx) : IP réelle pour la limitation des connexions.
app.set('trust proxy', 'loopback');

app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Vérification de disponibilité.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', apiRouter);

// Route d'API inconnue → 404 JSON.
app.use('/api', (_req, res) => {
  res.status(404).json({ erreur: 'Ressource introuvable.' });
});

// Production : l'API sert aussi l'interface compilée (CLIENT_DIST), sur la même
// origine — nécessaire au cookie de session. Fichiers à empreinte (assets/)
// gardés un an ; index.html et sw.js toujours revérifiés (mises à jour PWA).
if (env.CLIENT_DIST && existsSync(resolve(env.CLIENT_DIST, 'index.html'))) {
  const racine = resolve(env.CLIENT_DIST);
  app.use(
    express.static(racine, {
      index: 'index.html',
      setHeaders: (res, chemin) => {
        if (/[\\/]assets[\\/]/.test(chemin)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
}

app.use((_req, res) => {
  res.status(404).json({ erreur: 'Ressource introuvable.' });
});

// Middleware d'erreur centralisé : messages clairs en français.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.statut).json({ erreur: err.message });
    return;
  }
  console.error('[Erreur non gérée]', err);
  res.status(500).json({ erreur: 'Une erreur interne est survenue. Réessayez plus tard.' });
});

