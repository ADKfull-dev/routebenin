/**
 * StopList — destinations de la tournée, sous forme d'étapes de l'itinéraire :
 * réordonnables (glisser-déposer + flèches, pour le clavier et le mobile),
 * supprimables, avec pour chacune un créneau de livraison et un nombre de colis
 * optionnels. Rend des <li> à placer dans un <Itineraire>.
 */
import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, Clock } from 'lucide-react';
import type { Arret } from '../types';
import { Etape } from './Itineraire';
import { libelleCourt } from '../lib/feuilleRoute';
import { libelleFenetre } from '../lib/horaires';

interface Props {
  destinations: Arret[];
  onReordonner: (nouvelles: Arret[]) => void;
  onSupprimer: (id: string) => void;
  onModifier: (id: string, modif: Partial<Pick<Arret, 'fenetre' | 'colis'>>) => void;
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

/** Résumé sous le nom : « 10:00–12:00, 3 colis ». */
function resume(d: Arret): string | null {
  const morceaux = [libelleFenetre(d.fenetre), d.colis !== undefined && d.colis !== 1 ? `${d.colis} colis` : null];
  const r = morceaux.filter(Boolean).join(', ');
  return r || null;
}

function Editeur({ arret, onModifier }: { arret: Arret; onModifier: Props['onModifier'] }) {
  const f = arret.fenetre ?? { debut: null, fin: null };
  const majFenetre = (champ: 'debut' | 'fin', v: string) => {
    const nouv = { ...f, [champ]: v || null };
    onModifier(arret.id, { fenetre: nouv.debut || nouv.fin ? nouv : null });
  };
  const incoherent = !!f.debut && !!f.fin && f.debut >= f.fin;
  const id = `ed-${arret.id}`;
  return (
    <div className="rounded-md border border-ligne bg-sol/60 p-3">
      <fieldset>
        <legend className="etiquette mb-1.5">Créneau de livraison</legend>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <label htmlFor={`${id}-debut`} className="text-encre/70">entre</label>
          <input id={`${id}-debut`} type="time" className="champ chiffre w-[6.4rem] px-2.5 py-1.5" value={f.debut ?? ''} onChange={(e) => majFenetre('debut', e.target.value)} />
          <label htmlFor={`${id}-fin`} className="text-encre/70">et</label>
          <input id={`${id}-fin`} type="time" className="champ chiffre w-[6.4rem] px-2.5 py-1.5" value={f.fin ?? ''} onChange={(e) => majFenetre('fin', e.target.value)} />
          {(f.debut || f.fin) && (
            <button type="button" onClick={() => onModifier(arret.id, { fenetre: null })} className="lien ml-1 text-sm">
              Retirer
            </button>
          )}
        </div>
        <p className={`mt-1 text-xs ${incoherent ? 'text-alerte' : 'text-encre/55'}`}>
          {incoherent ? 'L’heure de fin doit être après l’heure de début.' : 'Laissez un champ vide pour « avant » ou « après » seulement.'}
        </p>
      </fieldset>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <label htmlFor={`${id}-colis`} className="etiquette">Colis</label>
        <input
          id={`${id}-colis`}
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          className="champ chiffre w-20 py-1.5"
          value={arret.colis ?? 1}
          onChange={(e) => onModifier(arret.id, { colis: Math.max(0, Math.min(999, Math.round(Number(e.target.value) || 0))) })}
        />
      </div>
    </div>
  );
}

export function StopList({ destinations, onReordonner, onSupprimer, onModifier }: Props) {
  const [glisse, setGlisse] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
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
      {destinations.map((d, i) => {
        const r = resume(d);
        const edition = ouvert === d.id;
        return (
          <Etape
            key={d.id}
            type="etape"
            numero={i + 1}
            draggable={!edition}
            onDragStart={() => setGlisse(i)}
            onDragEnter={() => (survol.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={deposer}
            className={`group rounded-md ${edition ? '' : 'cursor-grab'} ${glisse === i ? 'opacity-50' : ''}`}
            dessous={edition && <Editeur arret={d} onModifier={onModifier} />}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setOuvert(edition ? null : d.id)}
                  aria-expanded={edition}
                  aria-label={`Créneau et colis pour ${d.label}`}
                  title="Créneau et colis"
                  className={`${btnIcone} ${d.fenetre || edition ? '!text-encre' : ''} ${edition ? 'bg-zem-100' : ''}`}
                >
                  <Clock className="h-4 w-4" />
                </button>
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
            {r && <p className="chiffre text-xs font-semibold text-encre/60">{r}</p>}
          </Etape>
        );
      })}
    </>
  );
}
