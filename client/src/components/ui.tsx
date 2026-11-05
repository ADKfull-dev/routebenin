/** Petits composants d'interface réutilisables. */
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** Indicateur de chargement circulaire. */
export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

/** Bloc de chargement (squelette). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10 ${className}`}
      aria-hidden
    />
  );
}

/** État vide illustré (quand aucune donnée). */
export function EmptyState({
  icone,
  titre,
  description,
  action,
}: {
  icone: ReactNode;
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-white/10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/10">
        {icone}
      </div>
      <div>
        <p className="font-semibold text-slate-700 dark:text-slate-100">{titre}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Carte de statistique (tableau de bord). */
export function StatCard({
  icone,
  valeur,
  libelle,
  accent = false,
}: {
  icone: ReactNode;
  valeur: string;
  libelle: string;
  accent?: boolean;
}) {
  return (
    <div className="carte p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            accent ? 'bg-succes/10 text-succes' : 'bg-electrique/10 text-electrique'
          }`}
        >
          {icone}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold text-slate-900 dark:text-white">{valeur}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{libelle}</p>
        </div>
      </div>
    </div>
  );
}
