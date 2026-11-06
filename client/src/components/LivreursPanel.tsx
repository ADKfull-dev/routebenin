/**
 * LivreursPanel — détail d'une répartition multi-livreurs : une carte par
 * livreur (couleur, charge, distance, durée, ordre de passage) avec son export.
 * Cliquer sur un livreur le met en évidence sur la carte.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, MessageCircle, Truck } from 'lucide-react';
import { api } from '../lib/api';
import type { ResultatOptimisation } from '../types';
import { couleurLivreur, encreSur } from '../lib/couleurs';
import { formatDistance, formatDuree } from '../lib/format';
import { libelleCourt, lienWhatsApp, texteFeuille } from '../lib/feuilleRoute';
import { charge, COUT_ARRET_M, COUT_ARRET_S } from '../lib/vrp';
import { ExportActions } from './ExportActions';

interface Props {
  resultat: ResultatOptimisation;
  nom?: string | null;
  livreurActif: number | null;
  onSelectionner: (i: number | null) => void;
}

export function LivreursPanel({ resultat, nom, livreurActif, onSelectionner }: Props) {
  const livreurs = resultat.livreurs ?? [];
  const [entreprise, setEntreprise] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    api
      .obtenirProfil()
      .then((p) => !annule && setEntreprise(p.nomEntreprise))
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);
  const nomLivreur = (i: number) => `${nom?.trim() || 'Tournée'} — Livreur ${i + 1}`;
  // Charge de travail : temps de conduite + 5 min par livraison (ou, sans
  // durées, distance + 2 km par arrêt) — le même critère que la répartition.
  const charges = livreurs.map((l) =>
    l.dureeSecondes !== null
      ? charge(l.dureeSecondes, l.nombreDestinations, COUT_ARRET_S)
      : charge(l.distanceOptimisee, l.nombreDestinations, COUT_ARRET_M),
  );
  const chargeMax = Math.max(...charges, 1);
  return (
    <section className="carte p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-nuit">
          <Truck className="h-4 w-4 text-electrique" /> {livreurs.length} livreurs
          {resultat.critereLivreurs && (
            <span className="font-normal text-nuit/45">
              · {resultat.critereLivreurs === 'arrets' ? 'même nombre d’arrêts' : 'charges équilibrées'}
            </span>
          )}
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
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectionner(actif ? null : i)}
                aria-expanded={actif}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-nuit">Livreur {i + 1}</span>
                  <span className="chiffre block text-xs text-nuit/55">
                    {l.nombreDestinations} arrêt{l.nombreDestinations > 1 ? 's' : ''} · {formatDistance(l.distanceOptimisee)}
                    {l.dureeSecondes !== null
                      ? ` · ${formatDuree(l.dureeSecondes)} de route + ${formatDuree(COUT_ARRET_S * l.nombreDestinations)} sur place`
                      : ''}
                  </span>
                  <span
                    className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-brume"
                    title="Charge de travail estimée : temps de route + 5 min par livraison"
                    aria-label={`Charge relative : ${Math.round((charges[i] / chargeMax) * 100)} %`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(charges[i] / chargeMax) * 100}%`, background: couleur }}
                    />
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-nuit/40 transition ${actif ? 'rotate-180' : ''}`} />
              </button>
              <a
                href={lienWhatsApp(texteFeuille({ resultat: l, boucle: true, nom: nomLivreur(i), entreprise }))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#128C4B] px-2.5 text-xs font-semibold text-white hover:bg-[#0f7a41]"
                aria-label={`Envoyer la tournée du livreur ${i + 1} sur WhatsApp`}
                title="Envoyer sur WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
              </div>
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
                    nom={nomLivreur(i)}
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
