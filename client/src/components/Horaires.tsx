/**
 * Horaires — affichage des contraintes horaires et de chargement d'un résultat :
 * synthèse (départ, retour, créneaux respectés, colis) et détail par arrêt.
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Arret, Horaires } from '../types';
import { formatHeure, libelleFenetre, minutes, resumeHoraires } from '../lib/horaires';

type AvecHoraires = Parameters<typeof resumeHoraires>[0];

export function SyntheseHoraires({ resultat }: { resultat: AvecHoraires }) {
  const h = resumeHoraires(resultat);
  if (!h) return null;
  const multi = !!resultat.livreurs && resultat.livreurs.length > 1;
  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      <p className="chiffre">
        Départ à <strong className="font-semibold">{formatHeure(h.heureDepart)}</strong>,{' '}
        {multi ? 'dernier retour' : 'fin de tournée'} vers <strong className="font-semibold">{formatHeure(h.heureFin)}</strong>
        {h.estime && <span className="text-encre/55"> (estimation sans service routier)</span>}.
      </p>
      {h.avecFenetres &&
        (h.retards === 0 ? (
          <p className="flex items-center gap-2 font-semibold text-gain">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Toutes les livraisons arrivent dans leur créneau.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-md bg-alerte-50 px-3 py-2 font-semibold text-alerte">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {h.retards} livraison{h.retards > 1 ? 's' : ''} hors créneau ({minutes(h.retardTotal)} de retard au total).
              {' '}Partez plus tôt{multi ? '' : ', ajoutez un livreur'} ou élargissez les créneaux.
            </span>
          </p>
        ))}
      {h.capacite !== null && (
        <p className={`chiffre ${h.surcharges ? 'font-semibold text-alerte' : 'text-encre/70'}`}>
          {multi ? 'Livreur le plus chargé' : 'Chargement'} : {h.chargeMax} / {h.capacite} colis
          {h.surcharges ? `, capacité dépassée${multi ? ` pour ${h.surcharges} livreur${h.surcharges > 1 ? 's' : ''}` : ''}` : ''}.
        </p>
      )}
    </div>
  );
}

/** Heure de passage (colonne de droite d'une étape). */
export function HeurePassage({ passage }: { passage: Horaires['passages'][number] | undefined }) {
  if (!passage) return null;
  return (
    <span className={`chiffre pl-2 text-sm font-semibold ${passage.retard > 0 ? 'text-alerte' : 'text-encre/70'}`}>
      {formatHeure(passage.arrivee)}
    </span>
  );
}

/** Créneau et statut sous le nom de l'arrêt. */
export function StatutPassage({ arret, passage }: { arret: Arret; passage: Horaires['passages'][number] | undefined }) {
  const creneau = libelleFenetre(arret.fenetre);
  const colis = arret.colis !== undefined && arret.colis !== 1 ? `${arret.colis} colis` : null;
  const statut =
    passage && passage.retard > 0
      ? { texte: `${minutes(passage.retard)} de retard`, classe: 'text-alerte' }
      : passage && passage.attente > 60
        ? { texte: `attente ${minutes(passage.attente)}`, classe: 'text-attention' }
        : null;
  if (!creneau && !colis && !statut) return null;
  return (
    <p className="chiffre text-xs text-encre/60">
      {[creneau, colis].filter(Boolean).join(', ')}
      {statut && (
        <>
          {creneau || colis ? ', ' : ''}
          <span className={`font-semibold ${statut.classe}`}>{statut.texte}</span>
        </>
      )}
    </p>
  );
}
