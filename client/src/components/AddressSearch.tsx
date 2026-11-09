/**
 * AddressSearch — champ de recherche d'adresse avec autocomplétion.
 *
 * Combine trois sources :
 *  1. le répertoire des quartiers du Grand Cotonou (instantané, vérifié à la main) ;
 *  2. le répertoire national des lieux du Bénin (77 communes, ~12 500 villes,
 *     villages et quartiers OSM), chargé à la demande — 1 et 2 marchent hors ligne
 *     et tolèrent fautes de frappe et accents manquants ;
 *  3. le service Nominatim (adresses précises), ajouté ensuite.
 *
 * Utilisé à l'identique pour le point de départ et pour les destinations.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Search, MapPin, Navigation2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { chercherQuartiers, normaliser } from '../lib/quartiers';
import { chercherLieux } from '../lib/lieuxBenin';
import type { Arret } from '../types';
import { Spinner } from './ui';

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
  local: boolean;
  /** Type affiché (Quartier, Ville, Localité…) pour les résultats locaux. */
  type?: string;
}

interface Props {
  onSelectionner: (arret: Arret) => void;
  placeholder?: string;
  /** Point de référence (ex. : le départ) : favorise les lieux voisins parmi les homonymes. */
  proche?: { lat: number; lng: number } | null;
}

let compteurId = 0;
const nouvelId = () => `arret-${Date.now()}-${++compteurId}`;
const cle = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export function AddressSearch({ onSelectionner, placeholder = 'Rechercher une adresse…', proche = null }: Props) {
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
    const quartiers = chercherQuartiers(q, 4);
    let locaux: Suggestion[] = quartiers.map((r) => ({ ...r, local: true }));
    setResultats(locaux);
    if (locaux.length > 0) setOuvert(true);
    let annule = false;

    // 2. Répertoire national (chargé une fois, puis instantané).
    const national = chercherLieux(q, { limite: 6, proche }).then((r) => {
      if (annule) return;
      const vus = new Set(locaux.map((x) => cle(x.lat, x.lng)));
      const prochesDeVus = (x: { lat: number; lng: number }) =>
        locaux.some((l) => Math.abs(l.lat - x.lat) < 0.004 && Math.abs(l.lng - x.lng) < 0.004);
      // Même nom (accents compris) et même ville qu'un quartier déjà proposé : doublon.
      const memesNoms = new Set(locaux.map((x) => normaliser(x.label)));
      const nationaux = r
        .filter((x) => !vus.has(cle(x.lat, x.lng)) && !prochesDeVus(x) && !memesNoms.has(normaliser(x.label)))
        .map((x) => ({ ...x, local: true }));
      // Quartiers trouvés exactement, puis le national, puis les quartiers trouvés « à une faute près ».
      const exacts = locaux.filter((_, i) => !quartiers[i].approche);
      const approches = locaux.filter((_, i) => quartiers[i].approche);
      locaux = [...exacts, ...nationaux, ...approches].slice(0, 7);
      setResultats(locaux);
      if (locaux.length > 0) setOuvert(true);
    });

    // 3. Nominatim : ajouté après un court délai (anti-rebond).
    setChargement(true);
    const t = setTimeout(async () => {
      try {
        const distants = await api.geocoder(q);
        await national;
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
        // Si Nominatim échoue, on garde au moins les lieux locaux.
        await national;
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
  }, [texte, proche?.lat, proche?.lng]);

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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre/40" />
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
          <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre/50" />
        )}
      </div>

      {erreur && <p className="mt-1 text-xs text-alerte">{erreur}</p>}

      {ouvert && resultats.length > 0 && (
        <ul id={listeId} className="absolute z-[650] mt-1 max-h-72 w-full overflow-auto rounded-md border border-ligne bg-white p-1 shadow-pop" role="listbox">
          {resultats.map((r, i) => (
            <li key={`${cle(r.lat, r.lng)}-${i}`}>
              <button
                type="button"
                onClick={() => choisir(r)}
                className="flex w-full items-center gap-2.5 rounded px-3 py-2.5 text-left text-[0.9375rem] hover:bg-sol"
                role="option"
                aria-selected="false"
              >
                {r.local ? (
                  <Navigation2 className="h-4 w-4 shrink-0 text-encre" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-encre/40" />
                )}
                <span className="flex-1 truncate">{r.label}</span>
                {r.local && r.type && (
                  <span className="shrink-0 rounded bg-zem-100 px-1.5 py-0.5 text-xs font-semibold text-encre">
                    {r.type}
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
