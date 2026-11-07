/**
 * Composants PWA : bandeau « hors ligne », bandeau « mise à jour », bouton
 * « Installer l'application » et carte d'état pour la page Paramètres.
 */
import { useEffect, useState } from 'react';
import { CloudOff, Download, RefreshCw, Smartphone, Trash2, Wifi } from 'lucide-react';
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

export function BandeauxPwa() {
  const { enLigne, miseAJour } = usePwa();
  const toast = useToast();

  useEffect(
    () => surPremiereInstallation(() => toast.succes('RouteBénin est prête à fonctionner hors ligne.')),
    [],
  );

  return (
    <>
      {!enLigne && (
        <div role="status" className="flex items-start gap-2.5 border-b border-attention/25 bg-attention/[0.08] px-4 py-2.5 text-sm text-nuit md:px-8">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
          <p>
            <strong className="font-semibold">Hors ligne.</strong> L’optimisation fonctionne (distances à vol d’oiseau
            si l’itinéraire n’est pas en cache), la recherche se limite aux quartiers enregistrés, l’historique reste
            accessible.
          </p>
        </div>
      )}
      {miseAJour && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-electrique/20 bg-electrique-50 px-4 py-2.5 text-sm text-nuit md:px-8">
          <RefreshCw className="h-4 w-4 shrink-0 text-electrique" />
          <p className="flex-1">Une nouvelle version de RouteBénin est disponible.</p>
          <button onClick={appliquerMiseAJour} className="rounded-lg bg-electrique px-3 py-1.5 text-xs font-semibold text-white hover:bg-electrique-600">
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
    if (await installer()) toast.succes('Application installée sur votre appareil.');
  };
  return compact ? (
    <button onClick={clic} className="flex items-center gap-1.5 rounded-lg border border-electrique/30 px-2.5 py-1.5 text-xs font-semibold text-electrique">
      <Download className="h-4 w-4" /> Installer
    </button>
  ) : (
    <button onClick={clic} className="btn-primaire">
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
    toast.info('Cartes et itinéraires en cache supprimés.');
  };

  return (
    <section className="carte p-5">
      <h2 className="mb-1 font-semibold text-slate-800 dark:text-white">Application et hors-ligne</h2>
      <p className="mb-4 text-sm text-slate-500">
        RouteBénin garde l’application, les zones de carte déjà consultées et les derniers itinéraires calculés pour
        fonctionner avec un réseau faible ou absent.
      </p>
      <ul className="mb-4 flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2">
          {enLigne ? <Wifi className="h-4 w-4 text-succes" /> : <CloudOff className="h-4 w-4 text-attention" />}
          {enLigne ? 'Connecté' : 'Hors ligne'}
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${swActif ? 'bg-succes' : 'bg-slate-300'}`} />
          {swActif ? 'Disponible hors ligne' : 'Mode hors-ligne pas encore prêt (rechargez la page une fois en ligne)'}
        </li>
        <li className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-electrique" />
          {installee ? 'Installée sur cet appareil' : 'Non installée'}
        </li>
        {espace !== null && <li className="pl-6 text-slate-500">Espace utilisé : {formatMo(espace)}</li>}
      </ul>
      <div className="flex flex-wrap gap-3">
        {installable && <BoutonInstaller />}
        {!installable && !installee && estIos() && (
          <p className="text-sm text-slate-600">
            Sur iPhone : touchez <strong>Partager</strong> puis <strong>Sur l’écran d’accueil</strong>.
          </p>
        )}
        {swActif && (
          <button onClick={vider} className="flex items-center gap-2 rounded-xl border border-ligne px-4 py-2.5 text-sm font-medium text-nuit/75 hover:bg-brume">
            <Trash2 className="h-4 w-4" /> Vider le cache des cartes
          </button>
        )}
      </div>
    </section>
  );
}
