/**
 * ResultCard — présentation claire du résultat d'optimisation :
 * distance avant/après, gain en grand, durée, et ordre de passage.
 */
import { TrendingDown, Clock, MapPin, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ResultatOptimisation } from '../types';
import { formatDistance, formatDuree, formatPourcent } from '../lib/format';

export function ResultCard({ resultat, boucle = true }: { resultat: ResultatOptimisation; boucle?: boolean }) {
  const { distanceInitiale, distanceOptimisee, gainMetres, gainPourcent, dureeSecondes } = resultat;

  // En dessous de ~4 destinations, tous les ordres donnent la même distance :
  // il n'y a rien à optimiser. On l'explique au lieu d'afficher « −0 % ».
  const dejaOptimale = gainPourcent < 0.5;
  const multi = !!resultat.livreurs && resultat.livreurs.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Élément héros : le gain (ou le constat « déjà optimale ») */}
      {dejaOptimale ? (
        <div className="rounded-2xl bg-nuit p-6 text-white">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <CheckCircle2 className="h-4 w-4 text-succes" />
            Tournée déjà optimale
          </div>
          <p className="chiffre mt-2 text-5xl font-extrabold leading-none tracking-tight">
            {formatDistance(distanceOptimisee)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {resultat.nombreDestinations < 3
              ? "Avec aussi peu d'arrêts, un seul trajet est possible : il n'y a rien à réordonner. Ajoutez plus de destinations (4 ou plus) pour voir l'optimisation réduire la distance."
              : "L'ordre de passage que vous avez saisi est déjà le plus court. Rien à améliorer."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-nuit p-6 text-white">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <TrendingDown className="h-4 w-4 text-succes" />
            Distance économisée
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="chiffre text-6xl font-extrabold leading-none tracking-tight text-succes">
              −{formatPourcent(gainPourcent)}
            </span>
            <span className="chiffre text-white/70">soit {formatDistance(gainMetres)}</span>
          </div>
          {multi && (
            <p className="mt-2 text-xs text-white/55">
              Par rapport à un partage des adresses entre {resultat.livreurs!.length} livreurs dans l’ordre de saisie.
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/[0.06] p-3.5">
              <p className="text-white/50">Avant</p>
              <p className="chiffre mt-0.5 text-lg font-semibold text-white/70 line-through decoration-alerte/70 decoration-2">
                {formatDistance(distanceInitiale)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.06] p-3.5">
              <p className="text-white/50">Après</p>
              <p className="chiffre mt-0.5 text-lg font-semibold text-succes">
                {formatDistance(distanceOptimisee)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Indicateurs secondaires */}
      <div className="grid grid-cols-2 gap-3">
        <div className="carte flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-electrique" />
          <div>
            <p className="text-xs text-nuit/50">{multi ? 'Durée (plus longue tournée)' : 'Durée estimée'}</p>
            <p className="chiffre font-semibold text-nuit">{formatDuree(dureeSecondes)}</p>
          </div>
        </div>
        <div className="carte flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-electrique" />
          <div>
            <p className="text-xs text-nuit/50">Destinations</p>
            <p className="chiffre font-semibold text-nuit">{resultat.nombreDestinations}</p>
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

      {/* Ordre de passage optimisé (en multi-livreurs : voir le panneau par livreur) */}
      {!multi && (
      <div className="carte p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Ordre de passage optimisé
        </p>
        <ol className="flex flex-col gap-2">
          {resultat.etapes.map((e, idx) => {
            const estDepart = idx === 0;
            const estArrivee = !boucle && idx === resultat.etapes.length - 1 && resultat.etapes.length > 1;
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
        {boucle && resultat.etapes.length > 1 && (
          <p className="mt-2 pl-10 text-xs text-slate-400">puis retour au départ</p>
        )}
      </div>
      )}
    </div>
  );
}
