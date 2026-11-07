/**
 * Composants PWA : bandeau « hors ligne », bandeau « mise à jour », bouton
 * « Installer l'application » et carte d'état pour la page Paramètres.
 */
import { useEffect, useState } from 'react';
import { CloudOff, Download, RefreshCw, Trash2 } from 'lucide-react';
import {
  appliquerMiseAJour,
  espaceUtilise,
  estIos,
  installer,
  surPremiereInstallation,
  usePwa,
  viderCacheCartes,
} from '../lib/pwa';
import { useToast } from './Toast';
import { SECTION } from './ui';

let toastAffiche = false;

export function BandeauxPwa() {
  const { enLigne, miseAJour } = usePwa();
  const toast = useToast();

  useEffect(
    () =>
      surPremiereInstallation(() => {
        if (toastAffiche) return; // une seule fois, même si l'événement arrive deux fois
        toastAffiche = true;
        toast.succes('RouteBénin fonctionne maintenant sans connexion.');
      }),
    [],
  );

  return (
    <>
      {!enLigne && (
        <div role="status" className="flex items-start gap-2.5 bg-attention-50 px-4 py-2.5 text-sm text-encre md:px-6">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
          <p>
            <strong className="font-semibold">Hors ligne.</strong> Vous pouvez optimiser (à vol d’oiseau si le trajet
            n’a jamais été calculé), chercher les quartiers enregistrés et consulter l’historique.
          </p>
        </div>
      )}
      {miseAJour && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-zem-100 px-4 py-2.5 text-sm text-encre md:px-6">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <p className="flex-1">Une nouvelle version de RouteBénin est prête.</p>
          <button onClick={appliquerMiseAJour} className="btn-encre px-3 py-1.5 text-sm">
            Mettre à jour
          </button>
        </div>
      )}
    </>
  );
}

export function BoutonInstaller({ compact = false }: { compact?: boolean }) {
  const { installable } = usePwa();
  const toast = useToast();
  if (!installable) return null;
  const clic = async () => {
    if (await installer()) toast.succes('Application installée.');
  };
  return compact ? (
    <button onClick={clic} className="flex items-center gap-1.5 rounded-md bg-zem px-3 py-1.5 text-sm font-semibold text-encre">
      <Download className="h-4 w-4" /> Installer
    </button>
  ) : (
    <button onClick={clic} className="btn-encre">
      <Download className="h-5 w-5" /> Installer l’application
    </button>
  );
}

const formatMo = (o: number) => `${(o / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;

export function CarteApplication() {
  const { enLigne, horsLignePret, installable, installee } = usePwa();
  const toast = useToast();
  const [espace, setEspace] = useState<number | null>(null);
  const swActif = horsLignePret || !!navigator.serviceWorker?.controller;

  useEffect(() => {
    espaceUtilise().then(setEspace);
  }, [horsLignePret]);

  const vider = async () => {
    await viderCacheCartes();
    setEspace(await espaceUtilise());
    toast.info('Cartes et itinéraires gardés en mémoire supprimés.');
  };

  const ligne = (ok: boolean, texte: string) => (
    <li className="flex items-center gap-2.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-gain' : 'bg-encre/25'}`} aria-hidden />
      {texte}
    </li>
  );

  return (
    <section className={SECTION}>
      <h2 className="mb-1 text-lg font-semibold">Application et hors-ligne</h2>
      <p className="aide mb-4 max-w-md text-sm">
        RouteBénin garde l’application, les zones de carte déjà vues et les derniers trajets calculés, pour marcher avec
        un réseau faible ou absent.
      </p>
      <ul className="mb-4 flex flex-col gap-2 text-[0.9375rem]">
        {ligne(enLigne, enLigne ? 'Connecté à internet' : 'Hors ligne')}
        {ligne(swActif, swActif ? 'Prête à fonctionner sans connexion' : 'Pas encore prête hors ligne : rechargez la page une fois connecté')}
        {ligne(installee, installee ? 'Installée sur cet appareil' : 'Pas installée sur cet appareil')}
        {espace !== null && <li className="chiffre pl-[18px] text-sm text-encre/55">Espace utilisé : {formatMo(espace)}</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {installable && <BoutonInstaller />}
        {!installable && !installee && estIos() && (
          <p className="text-sm">
            Sur iPhone : touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.
          </p>
        )}
        {swActif && (
          <button onClick={vider} className="btn-secondaire text-sm">
            <Trash2 className="h-4 w-4" /> Vider les cartes en mémoire
          </button>
        )}
      </div>
    </section>
  );
}
