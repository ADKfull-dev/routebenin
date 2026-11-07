/**
 * History — liste des tournées sauvegardées, avec détail (carte + résultat).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, X, Plus } from 'lucide-react';
import { api, ApiError, type ResumeTournee } from '../lib/api';
import { Skeleton, EmptyState, Spinner, EnTetePage } from '../components/ui';
import { MapView, type MarqueurCarte } from '../components/MapView';
import { ResultCard } from '../components/ResultCard';
import { ExportActions } from '../components/ExportActions';
import { useToast } from '../components/Toast';
import { formatDistance, formatPourcent, formatDate } from '../lib/format';
import type { TourneeSauvegardee } from '../types';
import { traceInitial, traceOptimise, carteMultiLivreurs } from '../lib/traces';
import { LivreursPanel } from '../components/LivreursPanel';

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
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-10">
      <EnTetePage titre="Historique" aide="Les tournées que vous avez enregistrées. Ouvrez-en une pour la revoir ou la renvoyer au livreur." />

      {erreur && <p className="mt-6 rounded-md bg-alerte-50 p-4 text-sm text-alerte">{erreur}</p>}

      <div className="mt-8">
        {tournees === null ? (
          <Skeleton className="h-48" />
        ) : tournees.length === 0 ? (
          <EmptyState
            titre="Aucune tournée enregistrée"
            description="Après une optimisation, donnez un nom à la tournée et enregistrez-la : elle apparaîtra ici."
            action={<Link to="/optimiser" className="btn-primaire"><Plus className="h-5 w-5" /> Nouvelle tournée</Link>}
          />
        ) : (
          <ul className="feuille divide-y divide-ligne">
            {tournees.map((t) => (
              <li key={t.id} className="flex items-center gap-2 pr-2 hover:bg-sol/60">
                <button onClick={() => ouvrirDetail(t.id)} className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.nom}</span>
                    <span className="chiffre mt-0.5 block text-sm text-encre/55">
                      {formatDate(t.creeLe)}, {t.nombreDestinations} livraison{t.nombreDestinations > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className="chiffre hidden text-encre/70 sm:block">{formatDistance(t.distanceOptimisee)}</span>
                  <span className="chiffre w-16 shrink-0 rounded-md bg-gain-50 py-1 text-center text-sm font-semibold text-gain">
                    −{formatPourcent(t.gainPourcent)}
                  </span>
                </button>
                <button
                  onClick={() => supprimer(t.id)}
                  disabled={suppression === t.id}
                  aria-label={`Supprimer ${t.nom}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-encre/40 hover:bg-alerte-50 hover:text-alerte"
                >
                  {suppression === t.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {chargementDetail && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-encre/30">
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

  const [livreurActif, setLivreurActif] = useState<number | null>(null);
  const multi = !!tournee.resultat.livreurs && tournee.resultat.livreurs.length > 1;

  const { marqueurs, trace, traceInitial: traceNaif, traces } = useMemo(() => {
    if (multi) {
      return { ...carteMultiLivreurs(tournee.resultat, livreurActif), trace: null, traceInitial: null };
    }
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
      traces: undefined,
      traceInitial:
        r.gainPourcent >= 0.5
          ? traceInitial(r, tournee.depart, tournee.destinations, tournee.arrivee)
          : null,
    };
  }, [tournee, arriveeDistincte, multi, livreurActif]);

  return (
    <div className="fixed inset-0 z-[950] flex items-end justify-center bg-encre/40 md:items-center md:p-6" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tournee.nom}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl bg-white shadow-pop md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ligne px-5 py-4">
          <div>
            <h2 className="font-titre text-xl font-bold">{tournee.nom}</h2>
            <p className="chiffre text-sm text-encre/55">{formatDate(tournee.creeLe)}</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer" className="btn-fantome px-2 py-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_420px]">
          <div className="relative h-72 md:h-auto md:min-h-[480px]">
            <MapView marqueurs={marqueurs} trace={trace} traceInitial={traceNaif} traces={traces} />
          </div>
          <div className="flex flex-col md:overflow-y-auto md:border-l md:border-ligne">
            {multi ? (
              <>
                <ResultCard resultat={tournee.resultat} boucle={!arriveeDistincte} />
                <LivreursPanel
                  resultat={tournee.resultat}
                  nom={tournee.nom}
                  livreurActif={livreurActif}
                  onSelectionner={setLivreurActif}
                />
              </>
            ) : (
              <ResultCard
                resultat={tournee.resultat}
                boucle={!arriveeDistincte}
                actions={<ExportActions resultat={tournee.resultat} boucle={!arriveeDistincte} nom={tournee.nom} />}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
