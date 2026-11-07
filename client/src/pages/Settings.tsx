/**
 * Settings — profil utilisateur / entreprise et préférences d'optimisation.
 */
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, ApiError, type Profil } from '../lib/api';
import { Skeleton, Spinner, SECTION, EnTetePage } from '../components/ui';
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
        minutesParLivraison: profil.minutesParLivraison,
      });
      setProfil(mis);
      toast.succes('Paramètres enregistrés.');
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  };

  const champ = (id: 'nomUtilisateur' | 'nomEntreprise' | 'ville', libelle: string, aide: string, placeholder: string) => (
    <div>
      <label htmlFor={id} className="etiquette mb-1.5">{libelle}</label>
      <input id={id} className="champ" value={profil?.[id] ?? ''} onChange={(e) => maj(id, e.target.value)} placeholder={placeholder} />
      <p className="aide mt-1">{aide}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-10">
      <EnTetePage titre="Paramètres" aide="Votre entreprise, le calcul des distances et l’application sur cet appareil." />

      {!profil ? (
        <Skeleton className="mt-8 h-72" />
      ) : (
        <div className="feuille mt-8">
          <section className={SECTION}>
            <h2 className="mb-4 text-lg font-semibold">Profil</h2>
            <div className="flex flex-col gap-4">
              {champ('nomEntreprise', 'Entreprise', 'Affiché en tête des feuilles de route envoyées aux livreurs.', 'Ex. : Boutique Akpakpa')}
              {champ('nomUtilisateur', 'Votre nom', 'Pour vous reconnaître si plusieurs personnes utilisent l’appareil.', 'Ex. : Aïcha')}
              {champ('ville', 'Ville', 'Ville où vous livrez le plus souvent.', 'Ex. : Cotonou')}
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="mb-4 text-lg font-semibold">Calcul des tournées</h2>
            <div className="mb-5">
              <label htmlFor="minutes" className="etiquette mb-1.5">Temps par livraison</label>
              <div className="flex items-center gap-3">
                <input
                  id="minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  className="champ chiffre w-24"
                  value={profil.minutesParLivraison}
                  onChange={(e) => maj('minutesParLivraison', Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0))))}
                />
                <span className="text-encre/70">minutes</span>
              </div>
              <p className="aide mt-1 max-w-md">
                Temps passé chez chaque client (se garer, remettre le colis, encaisser). Il s’ajoute au temps de route
                pour la durée totale, et sert à équilibrer le travail entre livreurs.
              </p>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="font-semibold">Utiliser les routes réelles</span>
                <span className="aide mt-0.5 block max-w-md text-sm">
                  Recommandé. Si le service d’itinéraire ne répond pas, RouteBénin calcule à vol d’oiseau.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={profil.prefererOsrm}
                aria-label="Utiliser les routes réelles"
                onClick={() => maj('prefererOsrm', !profil.prefererOsrm)}
                className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${profil.prefererOsrm ? 'bg-encre' : 'bg-ligne'}`}
              >
                <span className={`absolute left-0 top-1 h-5 w-5 rounded-full transition-transform ${profil.prefererOsrm ? 'translate-x-6 bg-zem' : 'translate-x-1 bg-white'}`} />
              </button>
            </label>
          </section>

          <CarteApplication />

          <div className="flex justify-end border-t border-ligne px-5 py-4">
            <button onClick={enregistrer} disabled={enregistrement} className="btn-primaire">
              {enregistrement ? <Spinner /> : <Save className="h-5 w-5" />}
              Enregistrer les paramètres
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
