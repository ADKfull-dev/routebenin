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
      className={`animate-pulse rounded-lg bg-ligne ${className}`}
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ligne p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brume text-electrique">
        {icone}
      </div>
      <div>
        <p className="font-semibold text-nuit">{titre}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-nuit/55">{description}</p>}
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
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          accent ? 'bg-succes/10 text-succes' : 'bg-electrique/10 text-electrique'
        }`}
      >
        {icone}
      </div>
      <p className="chiffre mt-4 truncate text-3xl font-bold tracking-tight text-nuit">{valeur}</p>
      <p className="mt-1 truncate text-sm text-nuit/55">{libelle}</p>
    </div>
  );
}
