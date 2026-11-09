/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" pour le build statique (GitHub Pages) : tout en navigateur. */
  readonly VITE_STATIC?: string;
  /** Chemin de base du site (ex. "/routebenin/" sur GitHub Pages). */
  readonly VITE_BASE?: string;
  /** Serveur OSRM auto-hébergé (mode navigateur), essayé avant le serveur public. */
  readonly VITE_OSRM_URL?: string;
  /** Page de présentation : numéro WhatsApp (chiffres, indicatif compris) et e-mail de contact. */
  readonly VITE_CONTACT_WHATSAPP?: string;
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
