/**
 * Connexion — se connecter, ou créer le compte de son entreprise (mode comptes).
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Building2 } from 'lucide-react';
import { Marque } from '../App';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { Spinner } from '../components/ui';

export function Connexion() {
  const { etat, rafraichir } = useSession();
  const [params] = useSearchParams();
  const naviguer = useNavigate();
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [champs, setChamps] = useState({ entreprise: '', nom: '', email: '', motDePasse: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const retour = params.get('retour');
  const destination = retour && retour.startsWith('/') && !retour.startsWith('/connexion') ? retour : '/';

  if (etat && (!etat.comptes || etat.utilisateur)) return <Navigate to={destination} replace />;

  const maj = (cle: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }));

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (mode === 'connexion') await api.connexion(champs.email, champs.motDePasse);
      else await api.inscription(champs);
      await rafraichir();
      naviguer(destination, { replace: true });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Connexion impossible pour le moment.');
    } finally {
      setEnvoi(false);
    }
  };

  const inscriptionPossible = etat?.inscriptionsOuvertes ?? false;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-encre px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Marque className="h-11 w-11" />
        <span className="font-titre text-2xl font-semibold text-white">RouteBénin</span>
      </div>
      <form onSubmit={envoyer} className="feuille w-full max-w-sm p-6" noValidate>
        <h1 className="font-titre text-xl font-bold">
          {mode === 'connexion' ? 'Connexion' : 'Créer le compte de votre entreprise'}
        </h1>
        <p className="mt-1 text-sm text-encre/60">
          {mode === 'connexion'
            ? 'Avec l’adresse e-mail donnée par votre administrateur.'
            : 'Vous en serez l’administrateur et pourrez ajouter votre équipe.'}
        </p>
        <div className="mt-5 flex flex-col gap-3.5">
          {mode === 'inscription' && (
            <>
              <div>
                <label htmlFor="entreprise" className="etiquette mb-1">Entreprise</label>
                <input id="entreprise" className="champ" autoComplete="organization" value={champs.entreprise} onChange={maj('entreprise')} placeholder="Ex. : Boutique Akpakpa" required />
              </div>
              <div>
                <label htmlFor="nom" className="etiquette mb-1">Votre nom</label>
                <input id="nom" className="champ" autoComplete="name" value={champs.nom} onChange={maj('nom')} required />
              </div>
            </>
          )}
          <div>
            <label htmlFor="email" className="etiquette mb-1">E-mail</label>
            <input id="email" type="email" inputMode="email" className="champ" autoComplete="email" value={champs.email} onChange={maj('email')} required />
          </div>
          <div>
            <label htmlFor="mdp" className="etiquette mb-1">Mot de passe</label>
            <input
              id="mdp"
              type="password"
              className="champ"
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
              value={champs.motDePasse}
              onChange={maj('motDePasse')}
              minLength={mode === 'inscription' ? 8 : undefined}
              required
            />
            {mode === 'inscription' && <p className="aide mt-1">Au moins 8 caractères.</p>}
          </div>
        </div>
        {erreur && <p className="mt-4 rounded-md bg-alerte-50 p-3 text-sm text-alerte" role="alert">{erreur}</p>}
        <button type="submit" disabled={envoi} className="btn-primaire mt-5 w-full py-3">
          {envoi ? <Spinner /> : mode === 'connexion' ? <LogIn className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          {mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
        </button>
        {inscriptionPossible && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'connexion' ? 'inscription' : 'connexion');
              setErreur(null);
            }}
            className="btn-fantome mt-2 w-full text-sm"
          >
            {mode === 'connexion' ? 'Nouvelle entreprise ? Créer un compte' : 'J’ai déjà un compte'}
          </button>
        )}
      </form>
      <Link to="/presentation" className="mt-5 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
        Découvrir RouteBénin
      </Link>
    </div>
  );
}
