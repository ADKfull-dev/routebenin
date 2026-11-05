/**
 * AddressSearch — champ de recherche d'adresse avec autocomplétion.
 *
 * Combine deux sources :
 *  1. un répertoire LOCAL des quartiers (instantané, tolérant aux fautes
 *     d'orthographe et aux accents manquants) — garantit que les quartiers
 *     apparaissent toujours ;
 *  2. le service Nominatim (adresses précises), ajouté ensuite.
 *
 * Utilisé à l'identique pour le point de départ et pour les destinations.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Search, MapPin, Navigation2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { chercherQuartiers } from '../lib/quartiers';
import type { Arret } from '../types';
import { Spinner } from './ui';

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
  local: boolean;
}

interface Props {
  onSelectionner: (arret: Arret) => void;
  placeholder?: string;
}

let compteurId = 0;
const nouvelId = () => `arret-${Date.now()}-${++compteurId}`;
const cle = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export function AddressSearch({ onSelectionner, placeholder = 'Rechercher une adresse…' }: Props) {
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<Suggestion[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const listeId = useId();

  useEffect(() => {
    const q = texte.trim();
    if (q.length < 2) {
      setResultats([]);
      setErreur(null);
      return;
    }

    // 1. Résultats locaux : immédiats, même sans connexion.
    const locaux: Suggestion[] = chercherQuartiers(q).map((r) => ({ ...r, local: true }));
    setResultats(locaux);
    if (locaux.length > 0) setOuvert(true);

    // 2. Nominatim : ajouté après un court délai (anti-rebond).
    let annule = false;
    setChargement(true);
    const t = setTimeout(async () => {
      try {
        const distants = await api.geocoder(q);
        if (annule) return;
        const vus = new Set(locaux.map((r) => cle(r.lat, r.lng)));
        const fusion = [
          ...locaux,
          ...distants
            .filter((r) => !vus.has(cle(r.lat, r.lng)))
            .map((r) => ({ ...r, local: false })),
        ];
        setResultats(fusion);
        setErreur(null);
        if (fusion.length > 0) setOuvert(true);
      } catch (e) {
        // Si Nominatim échoue, on garde au moins les quartiers locaux.
        if (!annule && locaux.length === 0) {
          setErreur(e instanceof ApiError ? e.message : 'Recherche impossible.');
        }
      } finally {
        if (!annule) setChargement(false);
      }
    }, 350);

    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [texte]);

  useEffect(() => {
    const gestion = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', gestion);
    return () => document.removeEventListener('mousedown', gestion);
  }, []);

  const choisir = (r: Suggestion) => {
    onSelectionner({ id: nouvelId(), label: r.label, lat: r.lat, lng: r.lng });
    setTexte('');
    setResultats([]);
    setOuvert(false);
  };

  return (
    <div className="relative" ref={conteneur}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nuit/35" />
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
        {chargement && (
          <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-electrique" />
        )}
      </div>

      {erreur && <p className="mt-1 text-xs text-alerte">{erreur}</p>}

      {ouvert && resultats.length > 0 && (
        <ul id={listeId} className="carte absolute z-30 mt-1 max-h-72 w-full overflow-auto p-1 shadow-pop" role="listbox">
          {resultats.map((r, i) => (
            <li key={`${cle(r.lat, r.lng)}-${i}`}>
              <button
                type="button"
                onClick={() => choisir(r)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-brume"
                role="option"
                aria-selected="false"
              >
                {r.local ? (
                  <Navigation2 className="h-4 w-4 shrink-0 text-electrique" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-nuit/40" />
                )}
                <span className="flex-1 truncate text-nuit">{r.label}</span>
                {r.local && (
                  <span className="shrink-0 rounded-full bg-electrique/10 px-2 py-0.5 text-[11px] font-medium text-electrique">
                    Quartier
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
