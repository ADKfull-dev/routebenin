/**
 * LivreursPanel — détail d'une répartition multi-livreurs : une carte par
 * livreur (couleur, charge, distance, durée, ordre de passage) avec son export.
 * Cliquer sur un livreur le met en évidence sur la carte.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { ResultatOptimisation } from '../types';
import { couleurLivreur, encreSur } from '../lib/couleurs';
import { formatDistance, formatDuree } from '../lib/format';
import { libelleCourt, lienWhatsApp, texteFeuille } from '../lib/feuilleRoute';
import { charge, COUT_ARRET_M } from '../lib/vrp';
import { dureeTournee, minutesParLivraison } from '../lib/duree';
import { ExportActions } from './ExportActions';
import { Etape, Itineraire } from './Itineraire';
import { SECTION } from './ui';
import { HeurePassage, StatutPassage } from './Horaires';
import { formatHeure, minutes as enMinutes } from '../lib/horaires';

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
  const minutes = minutesParLivraison(resultat);
  const charges = livreurs.map((l) =>
    l.dureeSecondes !== null
      ? charge(l.dureeSecondes, l.nombreDestinations, minutes * 60)
      : charge(l.distanceOptimisee, l.nombreDestinations, COUT_ARRET_M),
  );
  const chargeMax = Math.max(...charges, 1);
  return (
    <section className={SECTION}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{livreurs.length} livreurs</h2>
        {livreurActif !== null && (
          <button type="button" onClick={() => onSelectionner(null)} className="lien text-sm">
            Voir tous les livreurs
          </button>
        )}
      </div>
      <p className="aide mb-3">
        {resultat.critereLivreurs === 'arrets'
          ? 'Même nombre d’arrêts pour chacun.'
          : `Charges équilibrées : temps de route + ${minutes} min par livraison.`}{' '}
        Touchez un livreur pour voir son trajet.
      </p>
      <ul className="flex flex-col divide-y divide-ligne rounded-md border border-ligne">
        {livreurs.map((l, i) => {
          const actif = livreurActif === i;
          const couleur = couleurLivreur(i);
          return (
            <li key={i} className={actif ? 'bg-zem-50' : ''}>
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => onSelectionner(actif ? null : i)}
                  aria-expanded={actif}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="chiffre flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-titre text-sm font-bold"
                    style={{ background: couleur, color: encreSur(couleur) }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">Livreur {i + 1}</span>
                      <span className="chiffre text-sm font-semibold" title={`Temps de route + ${minutes} min par livraison`}>
                        {l.dureeSecondes !== null ? formatDuree(dureeTournee(l, minutes)!.total) : formatDistance(l.distanceOptimisee)}
                      </span>
                    </span>
                    <span className="chiffre block text-xs text-encre/55">
                      {l.nombreDestinations} arrêt{l.nombreDestinations > 1 ? 's' : ''}, {formatDistance(l.distanceOptimisee)}
                      {l.dureeSecondes !== null ? `, ${formatDuree(l.dureeSecondes)} de route` : ''}
                      {l.horaires ? `, retour vers ${formatHeure(l.horaires.heureFin)}` : ''}
                      {l.horaires?.capacite != null ? `, ${l.horaires.charge}/${l.horaires.capacite} colis` : ''}
                    </span>
                    {l.horaires && l.horaires.retards > 0 && (
                      <span className="chiffre block text-xs font-semibold text-alerte">
                        {l.horaires.retards} hors créneau ({enMinutes(l.horaires.retardTotal)} de retard)
                      </span>
                    )}
                    {l.horaires?.capacite != null && l.horaires.charge > l.horaires.capacite && (
                      <span className="block text-xs font-semibold text-alerte">Capacité dépassée</span>
                    )}
                    <span
                      className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-sol"
                      title={`Charge de travail estimée : temps de route + ${minutes} min par livraison`}
                      aria-label={`Charge relative : ${Math.round((charges[i] / chargeMax) * 100)} %`}
                    >
                      <span className="block h-full rounded-full" style={{ width: `${(charges[i] / chargeMax) * 100}%`, background: couleur }} />
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-encre/40 transition-transform ${actif ? 'rotate-180' : ''}`} />
                </button>
                <a
                  href={lienWhatsApp(texteFeuille({ resultat: { ...l, minutesParLivraison: minutes }, boucle: true, nom: nomLivreur(i), entreprise }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp h-9 shrink-0 px-2.5 text-sm"
                  aria-label={`Envoyer la tournée du livreur ${i + 1} sur WhatsApp`}
                  title="Envoyer sur WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
              {actif && (
                <div className="flex flex-col gap-3 px-3 pb-3">
                  <Itineraire>
                    <Etape
                      type="depart"
                      premier
                      actions={l.horaires && <span className="chiffre pl-2 text-sm font-semibold text-encre/70">{formatHeure(l.horaires.heureDepart)}</span>}
                    >
                      <p className="text-sm text-encre/60">Départ</p>
                    </Etape>
                    {l.etapes.slice(1).map((e, idx) => (
                      <Etape
                        key={`${e.arret.id}-${idx}`}
                        type="etape"
                        numero={idx + 1}
                        couleur={couleur}
                        actions={<HeurePassage passage={l.horaires?.passages[idx]} />}
                      >
                        <p className="truncate text-[0.9375rem]" title={e.arret.label}>{libelleCourt(e.arret.label)}</p>
                        <StatutPassage arret={e.arret} passage={l.horaires?.passages[idx]} />
                      </Etape>
                    ))}
                    <Etape
                      type="retour"
                      dernier
                      actions={l.horaires && <span className="chiffre pl-2 text-sm font-semibold text-encre/70">{formatHeure(l.horaires.heureFin)}</span>}
                    >
                      <p className="text-sm text-encre/60">Retour au départ</p>
                    </Etape>
                  </Itineraire>
                  <ExportActions resultat={{ ...l, minutesParLivraison: minutes }} boucle nom={nomLivreur(i)} compact />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
