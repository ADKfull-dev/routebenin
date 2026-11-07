/** Petits composants d'interface réutilisables. */
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** Section d'un panneau : séparée de la suivante par un filet. */
export const SECTION = 'border-b border-ligne px-5 py-5 last:border-b-0';

/** Indicateur de chargement circulaire. */
export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

/** Bloc de chargement (squelette). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ligne/70 ${className}`} aria-hidden />;
}

/** En-tête de page : titre + phrase d'aide + actions éventuelles. */
export function EnTetePage({ titre, aide, actions }: { titre: string; aide?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-titre text-2xl font-bold tracking-tight">{titre}</h1>
        {aide && <p className="mt-1 text-encre/60">{aide}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** État vide : ce qu'on peut faire ici, et le bouton pour le faire. */
export function EmptyState({
  titre,
  description,
  action,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="feuille flex flex-col items-start gap-4 p-6 sm:p-8">
      <div>
        <p className="font-titre text-xl font-semibold">{titre}</p>
        {description && <p className="mt-1 max-w-md text-encre/60">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
