/**
 * LivreursPanel — détail d'une répartition multi-livreurs : une carte par
 * livreur (couleur, charge, distance, durée, ordre de passage) avec son export.
 * Cliquer sur un livreur le met en évidence sur la carte.
 */
import { ChevronDown, Truck } from 'lucide-react';
import type { ResultatOptimisation } from '../types';
import { couleurLivreur, encreSur } from '../lib/couleurs';
import { formatDistance, formatDuree } from '../lib/format';
import { libelleCourt } from '../lib/feuilleRoute';
import { ExportActions } from './ExportActions';

interface Props {
  resultat: ResultatOptimisation;
  nom?: string | null;
  livreurActif: number | null;
  onSelectionner: (i: number | null) => void;
}

export function LivreursPanel({ resultat, nom, livreurActif, onSelectionner }: Props) {
  const livreurs = resultat.livreurs ?? [];
  return (
    <section className="carte p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-nuit">
          <Truck className="h-4 w-4 text-electrique" /> {livreurs.length} livreurs
        </p>
        {livreurActif !== null && (
          <button type="button" onClick={() => onSelectionner(null)} className="text-xs text-electrique hover:underline">
            Tout afficher
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {livreurs.map((l, i) => {
          const actif = livreurActif === i;
          const couleur = couleurLivreur(i);
          return (
            <li key={i} className={`rounded-xl border p-3 transition ${actif ? 'border-electrique bg-electrique-50/40' : 'border-ligne'}`}>
              <button
                type="button"
                onClick={() => onSelectionner(actif ? null : i)}
                aria-expanded={actif}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-nuit">Livreur {i + 1}</span>
                  <span className="chiffre block text-xs text-nuit/55">
                    {l.nombreDestinations} arrêt{l.nombreDestinations > 1 ? 's' : ''} · {formatDistance(l.distanceOptimisee)}
                    {l.dureeSecondes !== null ? ` · ${formatDuree(l.dureeSecondes)}` : ''}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-nuit/40 transition ${actif ? 'rotate-180' : ''}`} />
              </button>
              {actif && (
                <div className="mt-3 flex flex-col gap-3">
                  <ol className="flex flex-col gap-1.5 text-sm">
                    {l.etapes.slice(1).map((e, idx) => (
                      <li key={`${e.arret.id}-${idx}`} className="flex items-center gap-2">
                        <span
                          className="chiffre flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={{ background: couleur, color: encreSur(couleur) }}
                        >
                          {idx + 1}
                        </span>
                        <span className="truncate text-nuit/80" title={e.arret.label}>
                          {libelleCourt(e.arret.label)}
                        </span>
                      </li>
                    ))}
                    <li className="pl-7 text-xs text-nuit/45">puis retour au départ</li>
                  </ol>
                  <ExportActions
                    resultat={l}
                    boucle
                    nom={`${nom?.trim() || 'Tournée'} — Livreur ${i + 1}`}
                    compact
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
