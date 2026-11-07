/**
 * Settings — profil utilisateur / entreprise et préférences d'optimisation.
 */
import { useEffect, useState } from 'react';
import { Save, User, Building2, MapPin } from 'lucide-react';
import { api, ApiError, type Profil } from '../lib/api';
import { Skeleton, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { CarteApplication } from '../components/Pwa';

export function Settings() {
  const toast = useToast();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    api
      .obtenirProfil()
      .then(setProfil)
      .catch((e) => toast.erreur(e instanceof ApiError ? e.message : 'Chargement du profil impossible.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maj = <K extends keyof Profil>(cle: K, valeur: Profil[K]) =>
    setProfil((p) => (p ? { ...p, [cle]: valeur } : p));

  const enregistrer = async () => {
    if (!profil) return;
    setEnregistrement(true);
    try {
      const mis = await api.mettreAJourProfil({
        nomUtilisateur: profil.nomUtilisateur,
        nomEntreprise: profil.nomEntreprise,
        ville: profil.ville,
        prefererOsrm: profil.prefererOsrm,
      });
      setProfil(mis);
      toast.succes('Paramètres enregistrés.');
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
      <p className="text-slate-500 dark:text-slate-400">Gérez votre profil et vos préférences.</p>

      {!profil ? (
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <section className="carte p-5">
            <h2 className="mb-4 font-semibold text-slate-800 dark:text-white">Profil</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="nom" className="etiquette mb-1.5 flex items-center gap-2">
                  <User className="h-4 w-4 text-electrique" /> Nom
                </label>
                <input id="nom" className="champ" value={profil.nomUtilisateur ?? ''} onChange={(e) => maj('nomUtilisateur', e.target.value)} placeholder="Votre nom" />
              </div>
              <div>
                <label htmlFor="entreprise" className="etiquette mb-1.5 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-electrique" /> Entreprise
                </label>
                <input id="entreprise" className="champ" value={profil.nomEntreprise ?? ''} onChange={(e) => maj('nomEntreprise', e.target.value)} placeholder="Nom de l’entreprise" />
              </div>
              <div>
                <label htmlFor="ville" className="etiquette mb-1.5 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-electrique" /> Ville
                </label>
                <input id="ville" className="champ" value={profil.ville ?? ''} onChange={(e) => maj('ville', e.target.value)} placeholder="Ex. : Cotonou" />
              </div>
            </div>
          </section>

          <section className="carte p-5">
            <h2 className="mb-4 font-semibold text-slate-800 dark:text-white">Préférences d’optimisation</h2>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="font-medium text-slate-800 dark:text-white">Utiliser les distances routières (OSRM)</span>
                <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                  Recommandé. Si le service est indisponible, l’application bascule automatiquement sur une estimation à vol d’oiseau.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={profil.prefererOsrm}
                onClick={() => maj('prefererOsrm', !profil.prefererOsrm)}
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
                  profil.prefererOsrm ? 'bg-electrique' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    profil.prefererOsrm ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </section>

          <CarteApplication />

          <button onClick={enregistrer} disabled={enregistrement} className="btn-primaire self-start">
            {enregistrement ? <Spinner /> : <Save className="h-5 w-5" />}
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}
