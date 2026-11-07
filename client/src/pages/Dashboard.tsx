/**
 * Dashboard — vue synthétique de l'activité + accès rapide à une nouvelle tournée.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, ApiError, type StatsDashboard } from '../lib/api';
import { Skeleton, EmptyState, EnTetePage } from '../components/ui';
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

  const vide = !!stats && stats.nombreTournees === 0;
  const chiffres = stats
    ? [
        { libelle: 'Tournées', valeur: String(stats.nombreTournees) },
        { libelle: 'Distance parcourue', valeur: formatDistance(stats.distanceTotale) },
        { libelle: 'Distance économisée', valeur: formatDistance(stats.gainTotal), gain: true },
        { libelle: 'Gain moyen par tournée', valeur: `−${formatPourcent(stats.tauxMoyenOptimisation)}`, gain: true },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-10">
      <EnTetePage
        titre="Tableau de bord"
        aide="Vos tournées enregistrées et les kilomètres gagnés grâce à l’optimisation."
        actions={
          !vide && (
            <Link to="/optimiser" className="btn-primaire">
              <Plus className="h-5 w-5" /> Nouvelle tournée
            </Link>
          )
        }
      />

      {erreur && <p className="mt-6 rounded-md bg-alerte-50 p-4 text-sm text-alerte">{erreur}</p>}

      {chargement ? (
        <Skeleton className="mt-8 h-28" />
      ) : vide ? (
        <div className="mt-8">
          <EmptyState
            titre="Aucune tournée pour l’instant"
            description="Optimisez votre première tournée, ou essayez avec 14 livraisons réelles à Cotonou, Abomey-Calavi et Porto-Novo."
            action={
              <>
                <Link to="/optimiser" className="btn-primaire">
                  <Plus className="h-5 w-5" /> Nouvelle tournée
                </Link>
                <Link to="/optimiser?exemple=1" className="btn-secondaire">
                  Essayer l’exemple
                </Link>
              </>
            }
          />
        </div>
      ) : (
        stats && (
          <>
            <dl className="feuille mt-8 grid grid-cols-2 lg:grid-cols-4">
              {chiffres.map((c, i) => (
                <div
                  key={c.libelle}
                  className={`px-5 py-5 ${i % 2 === 1 ? 'border-l border-ligne' : ''} ${i >= 2 ? 'border-t border-ligne lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
                >
                  <dt className="text-sm text-encre/60">{c.libelle}</dt>
                  <dd className={`chiffre mt-1 font-titre text-2xl font-bold tracking-tight ${c.gain ? 'text-gain' : ''}`}>
                    {c.valeur}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Dernières tournées</h2>
              <Link to="/historique" className="lien text-sm">
                Tout l’historique
              </Link>
            </div>
            <ul className="feuille mt-3 divide-y divide-ligne">
              {stats.dernieres.map((t) => (
                <li key={t.id}>
                  <Link to="/historique" className="flex items-center gap-4 px-5 py-4 hover:bg-sol/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.nom}</p>
                      <p className="chiffre mt-0.5 text-sm text-encre/55">
                        {formatDate(t.creeLe)}, {t.nombreDestinations} livraison{t.nombreDestinations > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="chiffre hidden text-encre/70 sm:block">{formatDistance(t.distanceOptimisee)}</span>
                    <span className="chiffre w-16 rounded-md bg-gain-50 py-1 text-center text-sm font-semibold text-gain">
                      −{formatPourcent(t.gainPourcent)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  );
}
