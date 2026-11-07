/**
 * Itineraire — la tournée dessinée comme un trajet : une ligne verticale relie
 * le départ, les arrêts numérotés (pastilles jaunes) et l'arrivée. Utilisé pour
 * la saisie (Optimize) comme pour l'ordre de passage optimisé (ResultCard), avec
 * les mêmes pastilles que sur la carte.
 */
import type { LiHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { encreSur } from '../lib/couleurs';

export type TypeEtape = 'depart' | 'etape' | 'arrivee' | 'retour' | 'ajout';

export function Pastille({
  type,
  numero,
  couleur,
}: {
  type: TypeEtape;
  numero?: number;
  /** Couleur imposée (multi-livreurs). */
  couleur?: string;
}) {
  const base = 'chiffre relative z-[1] flex shrink-0 items-center justify-center font-titre font-bold';
  switch (type) {
    case 'depart':
      return <span className={`${base} h-7 w-7 rounded-md bg-encre text-[0.8125rem] text-white`}>D</span>;
    case 'arrivee':
      return (
        <span className={`${base} h-7 w-7 rounded-md border-2 border-encre bg-white text-[0.8125rem] text-encre`}>A</span>
      );
    case 'retour':
      return <span className={`${base} mt-[7px] h-3.5 w-3.5 rounded-full border-2 border-encre bg-white`} aria-hidden />;
    case 'ajout':
      return (
        <span className={`${base} h-7 w-7 rounded-full border-[1.5px] border-dashed border-encre/40 bg-white text-encre/50`}>
          <Plus className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span
          className={`${base} h-7 w-7 rounded-full border-[1.5px] border-encre text-[0.875rem] text-encre`}
          style={couleur ? { background: couleur, color: encreSur(couleur) } : { background: '#FFC414' }}
        >
          {numero}
        </span>
      );
  }
}

/**
 * Une ligne de l'itinéraire. Le segment de ligne au-dessus/au-dessous de la
 * pastille est masqué pour la première/dernière ligne.
 */
export function Etape({
  type,
  numero,
  couleur,
  premier = false,
  dernier = false,
  pointille = false,
  pointilleHaut = false,
  avecChamp = false,
  dessous,
  children,
  actions,
  className = '',
  ...li
}: {
  type: TypeEtape;
  numero?: number;
  couleur?: string;
  premier?: boolean;
  dernier?: boolean;
  /** Segment suivant en pointillé (vers une étape encore à saisir). */
  pointille?: boolean;
  /** Segment précédent en pointillé. */
  pointilleHaut?: boolean;
  /** La ligne contient un champ de saisie : pas de marge verticale (champ centré sur la pastille). */
  avecChamp?: boolean;
  /** Bloc pleine largeur sous la ligne (ex. : éditeur de créneau). */
  dessous?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
} & Omit<LiHTMLAttributes<HTMLLIElement>, 'children'>) {
  const style = (p: boolean) => (p ? 'border-l-2 border-dashed border-encre/30' : 'border-l-2 border-encre');
  // Centre vertical de la pastille : 22 px (ligne de texte) ou 27 px (champ de saisie, avec 5 px d'air).
  const centre = avecChamp ? 27 : 22;
  return (
    <li className={`relative flex min-h-[44px] flex-wrap items-start gap-x-3 ${avecChamp ? 'py-[5px]' : ''} ${className}`} {...li}>
      {/* Rail : segments haut et bas, centrés sur la pastille. */}
      {!premier && <span className={`absolute left-[13px] top-0 ${style(pointilleHaut)}`} style={{ height: centre }} aria-hidden />}
      {!dernier && <span className={`absolute bottom-0 left-[13px] ${style(pointille)}`} style={{ top: centre }} aria-hidden />}
      <span className="flex w-7 shrink-0 justify-center" style={{ marginTop: centre - 14 - (avecChamp ? 5 : 0) }}>
        <Pastille type={type} numero={numero} couleur={couleur} />
      </span>
      <div className={`min-w-0 flex-1 ${avecChamp ? '' : 'py-[11px]'}`}>{children}</div>
      {actions && <div className="mt-1.5 flex shrink-0 items-center">{actions}</div>}
      {dessous && <div className="basis-full pb-2 pl-10">{dessous}</div>}
    </li>
  );
}

export function Itineraire({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ol className={`flex flex-col ${className}`}>{children}</ol>;
}
