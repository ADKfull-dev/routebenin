/**
 * StopList — destinations de la tournée, sous forme d'étapes de l'itinéraire :
 * réordonnables (glisser-déposer + flèches, pour le clavier et le mobile) et
 * supprimables. Rend des <li> à placer dans un <Itineraire>.
 */
import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import type { Arret } from '../types';
import { Etape } from './Itineraire';
import { libelleCourt } from '../lib/feuilleRoute';

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

const btnIcone =
  'flex h-8 w-8 items-center justify-center rounded-md text-encre/45 hover:bg-sol hover:text-encre disabled:pointer-events-none disabled:opacity-25';

export function StopList({ destinations, onReordonner, onSupprimer }: Props) {
  const [glisse, setGlisse] = useState<number | null>(null);
  const survol = useRef<number | null>(null);

  const deposer = () => {
    if (glisse !== null && survol.current !== null && glisse !== survol.current) {
      onReordonner(deplacer(destinations, glisse, survol.current));
    }
    setGlisse(null);
    survol.current = null;
  };

  return (
    <>
      {destinations.map((d, i) => (
        <Etape
          key={d.id}
          type="etape"
          numero={i + 1}
          draggable
          onDragStart={() => setGlisse(i)}
          onDragEnter={() => (survol.current = i)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={deposer}
          className={`group cursor-grab rounded-md ${glisse === i ? 'opacity-50' : ''}`}
          actions={
            <>
              <button type="button" onClick={() => onReordonner(deplacer(destinations, i, i - 1))} disabled={i === 0} aria-label={`Monter ${d.label}`} className={btnIcone}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onReordonner(deplacer(destinations, i, i + 1))} disabled={i === destinations.length - 1} aria-label={`Descendre ${d.label}`} className={btnIcone}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onSupprimer(d.id)} aria-label={`Retirer ${d.label}`} className={`${btnIcone} hover:!bg-alerte-50 hover:!text-alerte`}>
                <X className="h-4 w-4" />
              </button>
            </>
          }
        >
          <p className="truncate text-[0.9375rem] font-medium" title={d.label}>
            {libelleCourt(d.label)}
          </p>
        </Etape>
      ))}
    </>
  );
}
