/**
 * ResultCard — résultat d'optimisation : distance optimisée comparée à l'ordre
 * de saisie (deux barres proportionnelles), chiffres clés, envoi au livreur et
 * ordre de passage dessiné comme un itinéraire. Rend des sections de panneau
 * séparées par un filet (classe `section-panneau`).
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ResultatOptimisation } from '../types';
import { formatDistance, formatDuree, formatPourcent } from '../lib/format';
import { libelleCourt } from '../lib/feuilleRoute';
import { Etape, Itineraire } from './Itineraire';
import { dureeJournee } from '../lib/duree';
import { HeurePassage, StatutPassage, SyntheseHoraires } from './Horaires';
import { formatHeure } from '../lib/horaires';

import { SECTION } from './ui';

function Barre({ libelle, valeur, part, fonce }: { libelle: string; valeur: number; part: number; fonce?: boolean }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm">
      <span className="text-encre/60">{libelle}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-sol">
        <span
          className={`block h-full rounded-full ${fonce ? 'bg-encre' : 'bg-encre/25'}`}
          style={{ width: `${Math.max(4, part * 100)}%` }}
        />
      </span>
      <span className={`chiffre text-right ${fonce ? 'font-semibold' : 'text-encre/60 line-through decoration-alerte/70'}`}>
        {formatDistance(valeur)}
      </span>
    </div>
  );
}

export function ResultCard({
  resultat,
  boucle = true,
  actions,
}: {
  resultat: ResultatOptimisation;
  boucle?: boolean;
  /** Bloc d'envoi au livreur, placé juste sous les chiffres clés. */
  actions?: ReactNode;
}) {
  const { distanceInitiale, distanceOptimisee, gainMetres, gainPourcent } = resultat;
  const duree = dureeJournee(resultat);
  // En dessous de ~4 destinations, tous les ordres donnent la même distance :
  // on l'explique au lieu d'afficher « −0 % ».
  const dejaOptimale = gainPourcent < 0.5;
  const avecFenetres = !!resultat.horaires?.avecFenetres || !!resultat.livreurs?.some((l) => l.horaires?.avecFenetres);
  const surcout = distanceOptimisee - distanceInitiale;
  const multi = !!resultat.livreurs && resultat.livreurs.length > 1;
  const etapes = resultat.etapes;
  const h = resultat.horaires ?? null;

  return (
    <>
      <section className={SECTION}>
        <p className="text-sm font-medium text-encre/60">
          {multi ? `Distance totale, ${resultat.livreurs!.length} livreurs` : 'Distance à parcourir'}
        </p>
        <p className="chiffre mt-1 font-titre text-3xl font-bold tracking-tight">{formatDistance(distanceOptimisee)}</p>

        {dejaOptimale && avecFenetres ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-encre/70">
            {surcout > 50
              ? `Les créneaux horaires imposent cet ordre : ${formatDistance(surcout)} de plus que l’ordre de saisie.`
              : 'Ordre calculé pour respecter les créneaux horaires.'}
          </p>
        ) : dejaOptimale ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-encre/70">
            {resultat.nombreDestinations < 3
              ? 'Avec si peu d’arrêts, un seul trajet est possible. Ajoutez 4 destinations ou plus pour que l’ordre de passage compte.'
              : 'L’ordre que vous avez saisi est déjà le plus court.'}
          </p>
        ) : (
          <>
            <p className="mt-2 inline-flex items-center rounded-md bg-gain-50 px-2.5 py-1 text-sm font-semibold text-gain">
              <span className="chiffre">
                {formatDistance(gainMetres)} de moins, soit −{formatPourcent(gainPourcent)}
              </span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Barre libelle="Avant" valeur={distanceInitiale} part={1} />
              <Barre libelle="Après" valeur={distanceOptimisee} part={distanceOptimisee / distanceInitiale} fonce />
            </div>
            <p className="aide mt-2">
              {multi
                ? 'Avant : adresses partagées entre les livreurs dans l’ordre de saisie.'
                : 'Avant : adresses parcourues dans l’ordre de saisie.'}
            </p>
          </>
        )}

        <dl className="mt-5 grid grid-cols-[1fr_auto] divide-x divide-ligne rounded-md border border-ligne">
          <div className="px-4 py-3">
            <dt className="aide">{multi ? 'Durée de la journée (livreur le plus long)' : 'Durée totale estimée'}</dt>
            <dd className="chiffre mt-0.5 font-titre text-lg font-semibold">{duree ? formatDuree(duree.total) : '—'}</dd>
            {duree && (
              <dd className="chiffre aide mt-0.5">
                {formatDuree(duree.route)} de route + {formatDuree(duree.surPlace)} sur place ({duree.minutesParLivraison} min par livraison)
                {duree.attente >= 60 ? ` + ${formatDuree(duree.attente)} d’attente` : ''}
              </dd>
            )}
          </div>
          <div className="px-4 py-3">
            <dt className="aide">Livraisons</dt>
            <dd className="chiffre mt-0.5 font-titre text-lg font-semibold">{resultat.nombreDestinations}</dd>
          </div>
        </dl>
        <SyntheseHoraires resultat={resultat} />
        {duree && (
          <p className="aide mt-2">Hors embouteillages. Réglez le temps par livraison dans les Paramètres.</p>
        )}

        {resultat.source === 'haversine' && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-attention-50 px-3 py-2.5 text-sm text-attention">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Distances estimées à vol d’oiseau : le service d’itinéraire n’a pas répondu. Sur la route, elles seront un peu plus longues.</span>
          </p>
        )}
      </section>

      {actions}

      {!multi && (
        <section className={SECTION}>
          <h2 className="mb-2 text-lg font-semibold">Ordre de passage</h2>
          <Itineraire>
            {etapes.map((e, idx) => {
              const estDepart = idx === 0;
              const estArrivee = !boucle && idx === etapes.length - 1 && etapes.length > 1;
              return (
                <Etape
                  key={`${e.arret.id}-${idx}`}
                  type={estDepart ? 'depart' : estArrivee ? 'arrivee' : 'etape'}
                  numero={idx}
                  premier={idx === 0}
                  dernier={!boucle && idx === etapes.length - 1}
                  actions={
                    h &&
                    (estDepart ? (
                      <span className="chiffre pl-2 text-sm font-semibold text-encre/70">{formatHeure(h.heureDepart)}</span>
                    ) : estArrivee ? (
                      <span className="chiffre pl-2 text-sm font-semibold text-encre/70">{formatHeure(h.heureFin)}</span>
                    ) : (
                      <HeurePassage passage={h.passages[idx - 1]} />
                    ))
                  }
                >
                  <p className="truncate text-[0.9375rem]" title={e.arret.label}>
                    {libelleCourt(e.arret.label)}
                  </p>
                  {!estDepart && !estArrivee && <StatutPassage arret={e.arret} passage={h?.passages[idx - 1]} />}
                </Etape>
              );
            })}
            {boucle && etapes.length > 1 && (
              <Etape
                type="retour"
                dernier
                actions={h && <span className="chiffre pl-2 text-sm font-semibold text-encre/70">{formatHeure(h.heureFin)}</span>}
              >
                <p className="text-sm text-encre/60">Retour au départ</p>
              </Etape>
            )}
          </Itineraire>
        </section>
      )}
    </>
  );
}
