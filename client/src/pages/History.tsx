/**
 * History — liste des tournées sauvegardées, avec détail (carte + résultat).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Trash2, Eye, X, Plus } from 'lucide-react';
import { api, ApiError, type ResumeTournee } from '../lib/api';
import { Skeleton, EmptyState, Spinner } from '../components/ui';
import { MapView, type MarqueurCarte } from '../components/MapView';
import { ResultCard } from '../components/ResultCard';
import { useToast } from '../components/Toast';
import { formatDistance, formatPourcent, formatDate } from '../lib/format';
import type { TourneeSauvegardee } from '../types';
import { traceInitial, traceOptimise } from '../lib/traces';

export function History() {
  const toast = useToast();
  const [tournees, setTournees] = useState<ResumeTournee[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<TourneeSauvegardee | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [suppression, setSuppression] = useState<string | null>(null);

  const charger = () => {
    api
      .listerTournees()
      .then(setTournees)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  };

  useEffect(charger, []);

  const ouvrirDetail = async (id: string) => {
    setChargementDetail(true);
    try {
      const t = await api.obtenirTournee(id);
      setDetail(t);
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Impossible d’ouvrir la tournée.');
    } finally {
      setChargementDetail(false);
    }
  };

  const supprimer = async (id: string) => {
    setSuppression(id);
    try {
      await api.supprimerTournee(id);
      setTournees((t) => (t ? t.filter((x) => x.id !== id) : t));
      toast.succes('Tournée supprimée.');
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Suppression impossible.');
    } finally {
      setSuppression(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historique</h1>
      <p className="text-slate-500 dark:text-slate-400">Retrouvez et consultez vos tournées optimisées.</p>

      {erreur && (
        <div className="mt-6 rounded-xl border border-alerte/30 bg-alerte/5 p-4 text-sm text-alerte">{erreur}</div>
      )}

      <div className="mt-6">
        {tournees === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : tournees.length === 0 ? (
          <EmptyState
            icone={<Inbox className="h-6 w-6" />}
            titre="Aucune tournée enregistrée"
            description="Optimisez une tournée puis enregistrez-la pour la retrouver ici."
            action={<Link to="/optimiser" className="btn-primaire"><Plus className="h-4 w-4" /> Nouvelle tournée</Link>}
          />
        ) : (
          <div className="carte divide-y divide-slate-100 dark:divide-white/5">
            {tournees.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                <button onClick={() => ouvrirDetail(t.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-nuit">{t.nom}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-nuit/45">
                    <span>{formatDate(t.creeLe)}</span>
                    <span className="chiffre">{t.nombreDestinations} destination{t.nombreDestinations > 1 ? 's' : ''}</span>
                    <span className="chiffre">{formatDistance(t.distanceOptimisee)}</span>
                  </p>
                </button>
                <span className="chiffre shrink-0 rounded-full bg-succes/10 px-2.5 py-1 text-sm font-semibold text-succes">
                  −{formatPourcent(t.gainPourcent)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => ouvrirDetail(t.id)} aria-label="Voir" className="btn-fantome px-2 py-1.5">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => supprimer(t.id)}
                    disabled={suppression === t.id}
                    aria-label="Supprimer"
                    className="rounded-lg p-2 text-slate-400 hover:bg-alerte/10 hover:text-alerte"
                  >
                    {suppression === t.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chargementDetail && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30">
          <Spinner className="h-8 w-8 text-white" />
        </div>
      )}

      {detail && <DetailModal tournee={detail} onFermer={() => setDetail(null)} />}
    </div>
  );
}

function DetailModal({ tournee, onFermer }: { tournee: TourneeSauvegardee; onFermer: () => void }) {
  const arriveeDistincte =
    tournee.arrivee !== null &&
    (Math.abs(tournee.arrivee.lat - tournee.depart.lat) > 1e-7 ||
      Math.abs(tournee.arrivee.lng - tournee.depart.lng) > 1e-7);

  const { marqueurs, trace, traceInitial: traceNaif } = useMemo(() => {
    const etapes = tournee.resultat.etapes;
    const m: MarqueurCarte[] = etapes.map((e, idx) => {
      const estDepart = idx === 0;
      const estArrivee = arriveeDistincte && idx === etapes.length - 1;
      return {
        id: `${e.arret.id}-${idx}`,
        lat: e.arret.lat,
        lng: e.arret.lng,
        label: e.arret.label,
        numero: estDepart ? undefined : idx,
        type: estDepart ? 'depart' : estArrivee ? 'arrivee' : 'etape',
      } as MarqueurCarte;
    });
    const r = tournee.resultat;
    return {
      marqueurs: m,
      trace: traceOptimise(r, !arriveeDistincte),
      traceInitial:
        r.gainPourcent >= 0.5
          ? traceInitial(r, tournee.depart, tournee.destinations, tournee.arrivee)
          : null,
    };
  }, [tournee, arriveeDistincte]);

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ligne p-4">
          <div>
            <h2 className="font-bold text-nuit">{tournee.nom}</h2>
            <p className="chiffre text-xs text-nuit/45">{formatDate(tournee.creeLe)}</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer" className="btn-fantome px-2 py-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <div className="h-72 overflow-hidden rounded-xl border border-slate-200 md:h-auto md:min-h-[360px] dark:border-white/10">
            <MapView marqueurs={marqueurs} trace={trace} traceInitial={traceNaif} />
          </div>
          <div>
            <ResultCard resultat={tournee.resultat} />
          </div>
        </div>
      </div>
    </div>
  );
}
