/**
 * Dashboard — vue synthétique de l'activité + accès rapide à une nouvelle tournée.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Route, Gauge, TrendingDown, MapPinned, Inbox } from 'lucide-react';
import { api, ApiError, type StatsDashboard } from '../lib/api';
import { StatCard, Skeleton, EmptyState } from '../components/ui';
import { formatDistance, formatPourcent, formatDate } from '../lib/format';

export function Dashboard() {
  const [stats, setStats] = useState<StatsDashboard | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    api
      .stats()
      .then((s) => !annule && setStats(s))
      .catch((e) => !annule && setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenue 👋</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Optimisez vos livraisons. Gagnez du temps. Réduisez vos distances.
          </p>
        </div>
        <Link to="/optimiser" className="btn-primaire">
          <Plus className="h-5 w-5" /> Nouvelle tournée
        </Link>
      </div>

      {erreur && (
        <div className="mt-6 rounded-xl border border-alerte/30 bg-alerte/5 p-4 text-sm text-alerte">
          {erreur}
        </div>
      )}

      {/* Statistiques */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {chargement ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : stats ? (
          <>
            <StatCard icone={<Route className="h-5 w-5" />} valeur={String(stats.nombreTournees)} libelle="Tournées effectuées" />
            <StatCard icone={<MapPinned className="h-5 w-5" />} valeur={formatDistance(stats.distanceTotale)} libelle="Distance parcourue" />
            <StatCard icone={<TrendingDown className="h-5 w-5" />} valeur={formatDistance(stats.gainTotal)} libelle="Distance économisée" accent />
            <StatCard icone={<Gauge className="h-5 w-5" />} valeur={formatPourcent(stats.tauxMoyenOptimisation)} libelle="Optimisation moyenne" accent />
          </>
        ) : null}
      </div>

      {/* Dernières tournées */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Dernières tournées</h2>
        {chargement ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : stats && stats.dernieres.length > 0 ? (
          <div className="carte divide-y divide-slate-100 dark:divide-white/5">
            {stats.dernieres.map((t) => (
              <Link
                key={t.id}
                to="/historique"
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-nuit">{t.nom}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 text-xs text-nuit/45">
                    <span>{formatDate(t.creeLe)}</span>
                    <span className="chiffre">{t.nombreDestinations} destination{t.nombreDestinations > 1 ? 's' : ''}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="chiffre text-nuit/55">{formatDistance(t.distanceOptimisee)}</span>
                  <span className="chiffre rounded-full bg-succes/10 px-2.5 py-1 font-semibold text-succes">
                    −{formatPourcent(t.gainPourcent)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icone={<Inbox className="h-6 w-6" />}
            titre="Aucune tournée pour le moment"
            description="Créez votre première tournée pour voir vos statistiques ici."
            action={
              <Link to="/optimiser" className="btn-primaire">
                <Plus className="h-4 w-4" /> Créer une tournée
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
