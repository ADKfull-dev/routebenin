/**
 * StopList — liste des destinations, réordonnable (glisser-déposer + flèches)
 * et avec suppression. Les flèches assurent l'accessibilité clavier/mobile.
 */
import { useRef, useState } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { Arret } from '../types';

interface Props {
  destinations: Arret[];
  onReordonner: (nouvelles: Arret[]) => void;
  onSupprimer: (id: string) => void;
}

function deplacer<T>(liste: T[], de: number, vers: number): T[] {
  if (vers < 0 || vers >= liste.length) return liste;
  const copie = liste.slice();
  const [item] = copie.splice(de, 1);
  copie.splice(vers, 0, item);
  return copie;
}

export function StopList({ destinations, onReordonner, onSupprimer }: Props) {
  const [glisse, setGlisse] = useState<number | null>(null);
  const survol = useRef<number | null>(null);

  const deposer = () => {
    if (glisse === null || survol.current === null || glisse === survol.current) {
      setGlisse(null);
      return;
    }
    onReordonner(deplacer(destinations, glisse, survol.current));
    setGlisse(null);
    survol.current = null;
  };

  return (
    <ul className="flex flex-col gap-2">
      {destinations.map((d, i) => (
        <li
          key={d.id}
          draggable
          onDragStart={() => setGlisse(i)}
          onDragEnter={() => (survol.current = i)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={deposer}
          className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition
            dark:bg-nuit-500 dark:border-white/10
            ${glisse === i ? 'border-electrique opacity-60' : 'border-slate-200'}`}
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" aria-hidden />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-electrique/10 text-xs font-bold text-electrique">
            {i + 1}
          </span>
          <span className="flex-1 truncate text-slate-700 dark:text-slate-200" title={d.label}>
            {d.label}
          </span>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onReordonner(deplacer(destinations, i, i - 1))}
              disabled={i === 0}
              aria-label="Monter"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onReordonner(deplacer(destinations, i, i + 1))}
              disabled={i === destinations.length - 1}
              aria-label="Descendre"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onSupprimer(d.id)}
              aria-label={`Supprimer ${d.label}`}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-alerte/10 hover:text-alerte"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
