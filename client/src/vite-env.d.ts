/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" pour le build statique (GitHub Pages) : tout en navigateur. */
  readonly VITE_STATIC?: string;
  /** Chemin de base du site (ex. "/routebenin/" sur GitHub Pages). */
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
