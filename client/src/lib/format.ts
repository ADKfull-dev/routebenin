/** Formatage des valeurs affichées (distances, durées, dates) en français. */

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Mètres → texte lisible ("850 m" ou "12,3 km"). */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  if (metres < 1000) return `${nf0.format(Math.round(metres))} m`;
  return `${nf1.format(metres / 1000)} km`;
}

/** Mètres → nombre de km (une décimale), sans unité. */
export function enKm(metres: number): number {
  return Math.round((metres / 1000) * 10) / 10;
}

/** Secondes → "1 h 05 min" / "25 min" / "—". */
export function formatDuree(secondes: number | null): string {
  if (secondes === null || !Number.isFinite(secondes)) return '—';
  const totalMin = Math.round(secondes / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min} min`;
  return `${h} h ${String(min).padStart(2, '0')} min`;
}

/** Pourcentage arrondi ("31 %"). */
export function formatPourcent(valeur: number): string {
  if (!Number.isFinite(valeur)) return '—';
  return `${Math.round(valeur)} %`;
}

/** Date ISO → "5 nov. 2026 à 18:12". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
