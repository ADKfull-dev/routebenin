/**
 * ResultCard — présentation claire du résultat d'optimisation :
 * distance avant/après, gain en grand, durée, et ordre de passage.
 */
import { TrendingDown, Clock, MapPin, Flag, AlertTriangle } from 'lucide-react';
import type { ResultatOptimisation } from '../types';
import { formatDistance, formatDuree, formatPourcent } from '../lib/format';

export function ResultCard({ resultat }: { resultat: ResultatOptimisation }) {
  const { distanceInitiale, distanceOptimisee, gainMetres, gainPourcent, dureeSecondes } = resultat;

  return (
    <div className="flex flex-col gap-4">
      {/* Gain mis en avant */}
      <div className="rounded-2xl bg-nuit p-5 text-white">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <TrendingDown className="h-4 w-4 text-succes" />
          Distance économisée
        </div>
        <div className="mt-1 flex items-end gap-3">
          <span className="text-4xl font-extrabold leading-none text-succes">
            −{formatPourcent(gainPourcent)}
          </span>
          <span className="pb-1 text-slate-300">soit {formatDistance(gainMetres)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">Avant</p>
            <p className="font-semibold line-through decoration-alerte/60">
              {formatDistance(distanceInitiale)}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">Après</p>
            <p className="font-semibold text-succes">{formatDistance(distanceOptimisee)}</p>
          </div>
        </div>
      </div>

      {/* Indicateurs secondaires */}
      <div className="grid grid-cols-2 gap-3">
        <div className="carte flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-electrique" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Durée estimée</p>
            <p className="font-semibold text-slate-800 dark:text-white">
              {formatDuree(dureeSecondes)}
            </p>
          </div>
        </div>
        <div className="carte flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-electrique" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Destinations</p>
            <p className="font-semibold text-slate-800 dark:text-white">
              {resultat.nombreDestinations}
            </p>
          </div>
        </div>
      </div>

      {/* Avertissement si distances à vol d'oiseau */}
      {resultat.source === 'haversine' && (
        <div className="flex items-start gap-2 rounded-xl border border-attention/30 bg-attention/5 p-3 text-sm text-attention">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Service d’itinéraire indisponible : distances estimées <strong>à vol d’oiseau</strong>.
            Les valeurs réelles sur route seront un peu différentes.
          </span>
        </div>
      )}

      {/* Ordre de passage optimisé */}
      <div className="carte p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Ordre de passage optimisé
        </p>
        <ol className="flex flex-col gap-2">
          {resultat.etapes.map((e, idx) => {
            const estDepart = idx === 0;
            const estArrivee = idx === resultat.etapes.length - 1 && resultat.etapes.length > 1;
            return (
              <li key={`${e.arret.id}-${idx}`} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    estDepart ? 'bg-nuit' : 'bg-electrique'
                  }`}
                >
                  {estDepart ? <Flag className="h-3.5 w-3.5" /> : idx}
                </span>
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200" title={e.arret.label}>
                  {e.arret.label}
                </span>
                {estDepart && <span className="text-xs text-slate-400">Départ</span>}
                {estArrivee && <span className="text-xs text-slate-400">Arrivée</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
