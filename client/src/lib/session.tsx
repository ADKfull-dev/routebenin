/**
 * session — état de connexion (mode comptes du serveur).
 *
 * Au démarrage, on demande au serveur si les comptes sont activés. Si oui et
 * que personne n'est connecté, les pages de l'application renvoient vers
 * /connexion ; une réponse 401 en cours de route (session expirée) aussi.
 * En mode navigateur ou mono-utilisateur, `comptes` vaut false : rien ne change.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, type EtatSession } from './api';
import { EVENEMENT_SESSION_EXPIREE } from './serverApi';

interface ContexteSession {
  /** null pendant le premier chargement. */
  etat: EtatSession | null;
  rafraichir: () => Promise<void>;
  deconnecter: () => Promise<void>;
}

const SANS_COMPTES: EtatSession = { comptes: false, inscriptionsOuvertes: false, utilisateur: null, entreprise: null };

const Contexte = createContext<ContexteSession>({
  etat: SANS_COMPTES,
  rafraichir: async () => undefined,
  deconnecter: async () => undefined,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatSession | null>(null);

  const rafraichir = useCallback(async () => {
    try {
      setEtat(await api.etatSession());
    } catch {
      // Serveur injoignable (hors ligne) : on n'empêche pas d'utiliser ce qui
      // est en cache ; les requêtes de données afficheront leur propre erreur.
      setEtat((e) => e ?? SANS_COMPTES);
    }
  }, []);

  const deconnecter = useCallback(async () => {
    await api.deconnexion().catch(() => undefined);
    await rafraichir();
  }, [rafraichir]);

  useEffect(() => {
    void rafraichir();
    const expiree = () => void rafraichir();
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, expiree);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, expiree);
  }, [rafraichir]);

  return <Contexte.Provider value={{ etat, rafraichir, deconnecter }}>{children}</Contexte.Provider>;
}

export const useSession = () => useContext(Contexte);

/** Protège les pages de l'application : connexion exigée en mode comptes. */
export function GardeSession({ children }: { children: ReactNode }) {
  const { etat } = useSession();
  const lieu = useLocation();
  if (etat === null) return null; // une fraction de seconde au démarrage
  if (etat.comptes && !etat.utilisateur) {
    return <Navigate to={`/connexion?retour=${encodeURIComponent(lieu.pathname + lieu.search)}`} replace />;
  }
  return <>{children}</>;
}
