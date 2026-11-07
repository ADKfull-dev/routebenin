/**
 * Service worker de RouteBénin — mode hors-ligne (PWA).
 *
 * Ce fichier est un MODÈLE : au build, le plugin `pwaServiceWorker` de
 * vite.config.ts remplace __VERSION__ et __PRECACHE__ (liste des fichiers du
 * build) puis l'écrit dans dist/sw.js. Il n'est pas actif en développement.
 *
 * Stratégies de cache, par type de requête :
 *  - coquille de l'application (HTML, JS, CSS, icônes, pack démo) : pré-cachée à
 *    l'installation → l'application s'ouvre et optimise sans aucun réseau ;
 *  - navigation : réseau d'abord (version à jour), sinon index.html du cache ;
 *  - tuiles OpenStreetMap : cache d'abord (seules les zones DÉJÀ consultées
 *    sont gardées, pas de téléchargement en masse — politique d'usage OSM),
 *    rafraîchies en arrière-plan au bout de 7 jours, 2 000 tuiles au plus ;
 *  - OSRM et Nominatim : réseau d'abord avec délai, sinon dernière réponse
 *    connue pour la même requête. Sans cache ni réseau, la requête échoue et
 *    l'application bascule d'elle-même sur les distances à vol d'oiseau ;
 *  - polices Google : cache d'abord ;
 *  - /api (mode serveur) : jamais mis en cache.
 */
const VERSION = '8202b2139830';
const PRECACHE = [
  "index.html",
  "assets/index-DlGXzgQh.css",
  "assets/index-CMv1FsJo.js",
  "assets/packDemo-D0mpjruL.js",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "manifest.webmanifest"
];

const CACHE_APP = `rb-app-${VERSION}`;
const CACHE_TUILES = 'rb-tuiles-v1';
const CACHE_DONNEES = 'rb-donnees-v1';
const CACHE_POLICES = 'rb-polices-v1';
const CACHES_CONNUS = [CACHE_APP, CACHE_TUILES, CACHE_DONNEES, CACHE_POLICES];

const MAX_TUILES = 2000;
const MAX_DONNEES = 300;
const AGE_MAX_TUILE = 7 * 24 * 3600 * 1000;
const DELAI_RESEAU_MS = 6000;

const BASE = new URL('./', self.registration.scope).href;
const INDEX = new URL('index.html', BASE).href;

/* ---------- Cycle de vie ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((c) =>
      c.addAll(PRECACHE.map((u) => new Request(new URL(u, BASE).href, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        if (nom.startsWith('rb-') && !CACHES_CONNUS.includes(nom)) await caches.delete(nom);
      }
      await self.clients.claim();
    })(),
  );
});

// La page demande l'activation d'une nouvelle version (bouton « Mettre à jour »).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVER') self.skipWaiting();
  if (event.data?.type === 'VIDER_CARTES') {
    event.waitUntil(Promise.all([caches.delete(CACHE_TUILES), caches.delete(CACHE_DONNEES)]));
  }
});

/* ---------- Outils ---------- */
async function limiter(nomCache, max) {
  const cache = await caches.open(nomCache);
  const cles = await cache.keys(); // ordre d'insertion : les plus anciennes d'abord
  for (let i = 0; i < cles.length - max; i++) await cache.delete(cles[i]);
}

// Requête CORS explicite : réponse lisible (pas « opaque », qui coûte ~7 Mo
// de quota par entrée dans Chrome) et en-tête Date exploitable.
const enCors = (req) => new Request(req.url, { mode: 'cors', credentials: 'omit' });

async function mettreEnCache(nomCache, req, rep, max) {
  if (!rep || !rep.ok) return;
  const cache = await caches.open(nomCache);
  await cache.put(req, rep);
  if (max) await limiter(nomCache, max);
}

/* ---------- Stratégies ---------- */
async function navigation(req) {
  try {
    const rep = await fetch(req);
    if (rep.ok) mettreEnCache(CACHE_APP, INDEX, rep.clone());
    return rep;
  } catch {
    return (await caches.match(INDEX)) ?? Response.error();
  }
}

async function cacheDabord(nomCache, req, { cors = false } = {}) {
  const enCache = await caches.match(req);
  if (enCache) return enCache;
  const rep = await fetch(cors ? enCors(req) : req);
  mettreEnCache(nomCache, req, rep.clone());
  return rep;
}

async function tuile(event) {
  const req = event.request;
  const enCache = await caches.match(req, { cacheName: CACHE_TUILES });
  const recharger = () =>
    fetch(enCors(req)).then((rep) => {
      event.waitUntil(mettreEnCache(CACHE_TUILES, req, rep.clone(), MAX_TUILES));
      return rep;
    });
  if (enCache) {
    const date = Date.parse(enCache.headers.get('date') ?? '');
    if (navigator.onLine && (!date || Date.now() - date > AGE_MAX_TUILE)) {
      event.waitUntil(recharger().catch(() => undefined));
    }
    return enCache;
  }
  return recharger();
}

async function reseauDabord(event) {
  const req = event.request;
  const reseau = fetch(req).then((rep) => {
    event.waitUntil(mettreEnCache(CACHE_DONNEES, req, rep.clone(), MAX_DONNEES));
    return rep;
  });
  const enCache = await caches.match(req, { cacheName: CACHE_DONNEES });
  if (!enCache) return reseau; // rien en réserve : on attend le réseau (ou son échec)
  // Réseau lent : on sert la dernière réponse connue au bout du délai.
  const delai = new Promise((ok) => setTimeout(() => ok(enCache), DELAI_RESEAU_MS));
  return Promise.race([reseau.catch(() => enCache), delai]);
}

/* ---------- Aiguillage ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/api/')) return; // backend : toujours en direct
    if (req.mode === 'navigate') return event.respondWith(navigation(req));
    return event.respondWith(cacheDabord(CACHE_APP, req));
  }
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    return event.respondWith(tuile(event));
  }
  if (url.hostname === 'router.project-osrm.org' || url.hostname === 'nominatim.openstreetmap.org') {
    return event.respondWith(reseauDabord(event));
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return event.respondWith(cacheDabord(CACHE_POLICES, req, { cors: true }));
  }
});
