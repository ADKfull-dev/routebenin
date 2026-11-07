/**
 * pwa — enregistrement du service worker et état « application » partagé :
 * connexion réseau, mise à jour disponible, installation sur l'écran d'accueil.
 *
 * Exposé sous forme de hooks React (useSyncExternalStore) pour que la bannière
 * hors-ligne, le bouton « Installer » et la page Paramètres restent synchrones.
 */
import { useSyncExternalStore } from 'react';

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface EtatPwa {
  enLigne: boolean;
  /** Un nouveau service worker attend : une mise à jour est prête. */
  miseAJour: boolean;
  /** Le service worker est actif : l'application fonctionne hors ligne. */
  horsLignePret: boolean;
  /** Le navigateur propose l'installation (Chrome / Edge / Android). */
  installable: boolean;
  /** Lancée depuis l'écran d'accueil (mode standalone). */
  installee: boolean;
}

const estStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

let etat: EtatPwa = {
  enLigne: navigator.onLine,
  miseAJour: false,
  horsLignePret: false,
  installable: false,
  installee: estStandalone(),
};
const abonnes = new Set<() => void>();
let enAttente: ServiceWorker | null = null;
let invite: EvenementInstallation | null = null;
const ecouteursPret = new Set<() => void>();

function maj(partiel: Partial<EtatPwa>) {
  etat = { ...etat, ...partiel };
  abonnes.forEach((f) => f());
}

export function usePwa(): EtatPwa {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
  );
}

/** Appelé une seule fois, la première fois que l'application devient disponible hors ligne. */
export function surPremiereInstallation(f: () => void): () => void {
  ecouteursPret.add(f);
  return () => ecouteursPret.delete(f);
}

export function appliquerMiseAJour(): void {
  if (!enAttente) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  enAttente.postMessage({ type: 'ACTIVER' });
}

export async function installer(): Promise<boolean> {
  if (!invite) return false;
  await invite.prompt();
  const { outcome } = await invite.userChoice;
  invite = null;
  maj({ installable: false });
  return outcome === 'accepted';
}

export async function viderCacheCartes(): Promise<void> {
  navigator.serviceWorker?.controller?.postMessage({ type: 'VIDER_CARTES' });
  await Promise.all([caches.delete('rb-tuiles-v1'), caches.delete('rb-donnees-v1')]).catch(() => undefined);
}

export async function espaceUtilise(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate();
    return e?.usage ?? null;
  } catch {
    return null;
  }
}

/** iOS / Safari : pas d'invite d'installation, il faut passer par « Partager ». */
export const estIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function demarrerPwa(): void {
  window.addEventListener('online', () => maj({ enLigne: true }));
  window.addEventListener('offline', () => maj({ enLigne: false }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on affiche notre propre bouton « Installer »
    invite = e as EvenementInstallation;
    maj({ installable: true });
  });
  window.addEventListener('appinstalled', () => {
    invite = null;
    maj({ installable: false, installee: true });
  });

  // Service worker : production uniquement (en dev, Vite sert les sources).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', async () => {
    try {
      const premiere = !navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      const suivre = (sw: ServiceWorker | null) => {
        if (!sw) return;
        const verifier = () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            enAttente = sw;
            maj({ miseAJour: true });
          }
          if (sw.state === 'activated' && premiere) {
            maj({ horsLignePret: true });
            ecouteursPret.forEach((f) => f());
          }
        };
        sw.addEventListener('statechange', verifier);
        verifier();
      };
      if (reg.waiting && navigator.serviceWorker.controller) suivre(reg.waiting);
      if (reg.active && !premiere) maj({ horsLignePret: true });
      suivre(reg.installing);
      reg.addEventListener('updatefound', () => suivre(reg.installing));
      // Vérifie les mises à jour au retour sur l'onglet (au plus une fois par heure).
      let derniere = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - derniere > 3600_000) {
          derniere = Date.now();
          reg.update().catch(() => undefined);
        }
      });
      // Demande un stockage persistant (moins de risque d'éviction du cache).
      navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      /* navigateur sans SW ou http non sécurisé : l'application marche quand même en ligne */
    }
  });
}
