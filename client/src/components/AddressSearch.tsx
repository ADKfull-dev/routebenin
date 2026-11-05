/**
 * AddressSearch — champ de recherche d'adresse avec autocomplétion (Nominatim).
 * Débounce les frappes et propose une liste de résultats sélectionnables.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Arret } from '../types';
import { Spinner } from './ui';

interface Props {
  onSelectionner: (arret: Arret) => void;
  placeholder?: string;
}

let compteurId = 0;
const nouvelId = () => `arret-${Date.now()}-${++compteurId}`;

export function AddressSearch({ onSelectionner, placeholder = 'Rechercher une adresse…' }: Props) {
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const listeId = useId();

  // Débounce : on attend 400 ms après la dernière frappe.
  useEffect(() => {
    if (texte.trim().length < 3) {
      setResultats([]);
      setErreur(null);
      return;
    }
    let annule = false;
    setChargement(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.geocoder(texte);
        if (!annule) {
          setResultats(r);
          setErreur(null);
          setOuvert(true);
        }
      } catch (e) {
        if (!annule) setErreur(e instanceof ApiError ? e.message : 'Recherche impossible.');
      } finally {
        if (!annule) setChargement(false);
      }
    }, 400);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [texte]);

  // Fermer la liste au clic extérieur.
  useEffect(() => {
    const gestion = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', gestion);
    return () => document.removeEventListener('mousedown', gestion);
  }, []);

  const choisir = (r: { label: string; lat: number; lng: number }) => {
    onSelectionner({ id: nouvelId(), label: r.label, lat: r.lat, lng: r.lng });
    setTexte('');
    setResultats([]);
    setOuvert(false);
  };

  return (
    <div className="relative" ref={conteneur}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className="champ pl-9"
          placeholder={placeholder}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onFocus={() => resultats.length > 0 && setOuvert(true)}
          aria-label="Rechercher une adresse"
          aria-expanded={ouvert}
          aria-controls={listeId}
          autoComplete="off"
        />
        {chargement && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-electrique" />}
      </div>

      {erreur && <p className="mt-1 text-xs text-alerte">{erreur}</p>}

      {ouvert && resultats.length > 0 && (
        <ul
          id={listeId}
          className="carte absolute z-30 mt-1 max-h-64 w-full overflow-auto p-1"
          role="listbox"
        >
          {resultats.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                onClick={() => choisir(r)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5"
                role="option"
                aria-selected="false"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electrique" />
                <span className="text-slate-700 dark:text-slate-200">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
