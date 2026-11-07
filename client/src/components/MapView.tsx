/**
 * MapView — carte interactive Leaflet.
 * Affiche des marqueurs numérotés, un tracé d'itinéraire (réel OSRM ou lignes
 * droites de repli) et permet d'ajouter un point par clic sur la carte.
 *
 * Si `traceInitial` est fourni, la carte propose une comparaison visuelle
 * « tournée naïve (ordre de saisie) vs tournée optimisée », avec un tracé
 * animé de l'itinéraire optimisé.
 */
import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { encreSur } from '../lib/couleurs';

export interface MarqueurCarte {
  id: string;
  lat: number;
  lng: number;
  label: string;
  numero?: number;
  type: 'depart' | 'arrivee' | 'etape' | 'simple';
  /** Couleur imposée (mode multi-livreurs). */
  couleur?: string;
  /** Affiché en retrait (un autre livreur est sélectionné). */
  attenue?: boolean;
}

/** Tracé coloré supplémentaire (mode multi-livreurs). */
export interface TraceCarte {
  positions: [number, number][];
  couleur: string;
  attenue?: boolean;
}

interface Props {
  marqueurs: MarqueurCarte[];
  /** Tracé optimisé au format [lat, lng]. */
  trace?: [number, number][] | null;
  /** Tracé de l'ordre de saisie [lat, lng] : active le mode comparaison. */
  traceInitial?: [number, number][] | null;
  /** Plusieurs tracés colorés (multi-livreurs) : remplace `trace`. */
  traces?: TraceCarte[] | null;
  onClickCarte?: (lat: number, lng: number) => void;
  /** Centre de la carte quand elle est vide (ville du profil). Cotonou par défaut. */
  centre?: [number, number] | null;
}

const CENTRE_COTONOU: [number, number] = [6.37, 2.42];

/**
 * Marqueurs = mêmes pastilles que l'itinéraire du panneau : arrêts en jaune
 * cerclés d'encre, départ en carré encre « D », arrivée en carré blanc « A ».
 */
function iconeMarqueur(m: MarqueurCarte): L.DivIcon {
  const taille = m.type === 'etape' ? 28 : 30;
  let fond = '#FFC414';
  let texte = '#171B3F';
  let rayon = '50%';
  let contenu = String(m.numero ?? '');
  if (m.couleur) {
    fond = m.couleur;
    texte = encreSur(m.couleur);
  }
  if (m.type === 'depart') {
    fond = '#171B3F';
    texte = '#FFFFFF';
    rayon = '7px';
    contenu = 'D';
  } else if (m.type === 'arrivee') {
    fond = '#FFFFFF';
    texte = '#171B3F';
    rayon = '7px';
    contenu = 'A';
  }
  const html = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      width:${taille}px;height:${taille}px;border-radius:${rayon};
      background:${fond};color:${texte};
      font:700 13px/1 'Barlow Semi Condensed',Barlow,sans-serif;font-variant-numeric:tabular-nums;
      border:2px solid #171B3F;box-shadow:0 0 0 2px #fff, 0 3px 8px rgba(23,27,63,.35);
      opacity:${m.attenue ? 0.3 : 1};">${contenu}</div>`;
  return L.divIcon({
    className: 'marqueur-numero',
    html,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

/** Ajuste la vue pour englober tous les marqueurs. */
function AjusterVue({ marqueurs }: { marqueurs: MarqueurCarte[] }) {
  const map = useMap();
  useEffect(() => {
    if (marqueurs.length === 0) return;
    if (marqueurs.length === 1) {
      map.setView([marqueurs[0].lat, marqueurs[0].lng], 14);
      return;
    }
    const bornes = L.latLngBounds(marqueurs.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bornes, { padding: [48, 48], maxZoom: 15 });
  }, [map, marqueurs]);
  return null;
}

/** Carte vide : centre sur la ville choisie (sans écraser une vue avec des points). */
function CentrerSiVide({ centre, vide }: { centre: [number, number] | null | undefined; vide: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (vide && centre) map.setView(centre, 12);
  }, [map, centre, vide]);
  return null;
}

/** Capte les clics sur la carte pour ajouter un point. */
function GestionClic({ onClickCarte }: { onClickCarte?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClickCarte?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type ModeComparaison = 'avant' | 'apres' | 'comparer';

const COULEUR_OPTIMISE = '#171B3F';
const COULEUR_NAIF = '#C8372D';
const DUREE_ANIMATION_MS = 2200;

/**
 * Révèle progressivement un tracé (effet « l'itinéraire se dessine »).
 * Renvoie le nombre de points à afficher ; `jeton` relance l'animation.
 */
function useTraceProgressif(ligne: [number, number][], actif: boolean, jeton: number): number {
  const [visibles, setVisibles] = useState(ligne.length);
  useEffect(() => {
    const respecteMouvement =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!actif || ligne.length < 2 || respecteMouvement) {
      setVisibles(ligne.length);
      return;
    }
    let raf = 0;
    const debut = performance.now();
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / DUREE_ANIMATION_MS);
      const facilite = 1 - Math.pow(1 - p, 3); // ease-out
      setVisibles(Math.max(2, Math.ceil(facilite * ligne.length)));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    setVisibles(2);
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [ligne, actif, jeton]);
  return Math.min(visibles, ligne.length);
}

export function MapView({ marqueurs, trace, traceInitial, traces, onClickCarte, centre }: Props) {
  const multi = !!traces && traces.length > 0;
  // Repli : si pas de tracé OSRM, relier les marqueurs par des lignes droites.
  const traceDroite = useMemo<[number, number][]>(
    () => marqueurs.map((m) => [m.lat, m.lng]),
    [marqueurs],
  );
  const ligne = trace && trace.length > 1 ? trace : traceDroite;

  const comparaison = !multi && !!traceInitial && traceInitial.length > 1;
  const [mode, setMode] = useState<ModeComparaison>('comparer');
  const [jeton, setJeton] = useState(0);
  const visibles = useTraceProgressif(ligne, comparaison && mode !== 'avant', jeton);
  const ligneAffichee = comparaison ? ligne.slice(0, visibles) : ligne;

  const montrerNaif = comparaison && mode !== 'apres';
  const montrerOptimise = !multi && (!comparaison || mode !== 'avant');

  const choisir = (m: ModeComparaison) => {
    setMode(m);
    setJeton((j) => j + 1);
  };

  return (
    // Remplit le conteneur parent (qui doit être `relative` et avoir une hauteur,
    // même minimale) : `h-full` seul donne 0 px quand le parent n'a qu'un min-height.
    <div className="absolute inset-0">
      <MapContainer center={CENTRE_COTONOU} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // CORS : tuiles lisibles par le service worker → gardées pour le hors-ligne.
          crossOrigin="anonymous"
        />
        {montrerNaif && traceInitial && (
          <Polyline
            positions={traceInitial}
            pathOptions={{
              color: COULEUR_NAIF,
              weight: mode === 'avant' ? 5 : 4,
              opacity: mode === 'avant' ? 0.85 : 0.6,
              dashArray: mode === 'avant' ? undefined : '8 8',
            }}
          />
        )}
        {montrerOptimise && ligneAffichee.length > 1 && (
          <Polyline
            positions={ligneAffichee}
            pathOptions={{ color: COULEUR_OPTIMISE, weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
        {multi &&
          traces!.map((t, i) => (
            <Polyline
              key={`${i}-${t.couleur}-${t.attenue ? 'a' : 'n'}`}
              positions={t.positions}
              pathOptions={{ color: t.couleur, weight: t.attenue ? 3 : 5, opacity: t.attenue ? 0.2 : 0.9 }}
            />
          ))}
        {marqueurs.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={iconeMarqueur(m)} title={m.label} />
        ))}
        <AjusterVue marqueurs={marqueurs} />
        <CentrerSiVide centre={centre} vide={marqueurs.length === 0} />
        <GestionClic onClickCarte={onClickCarte} />
      </MapContainer>

      {comparaison && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-ligne bg-white p-1.5 text-sm shadow-pop">
            <div className="flex rounded-md bg-sol p-0.5" role="group" aria-label="Comparer les tracés">
              {(
                [
                  ['avant', 'Avant'],
                  ['apres', 'Après'],
                  ['comparer', 'Comparer'],
                ] as const
              ).map(([m, libelle]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => choisir(m)}
                  aria-pressed={mode === m}
                  className={`rounded px-3 py-1.5 font-semibold transition-colors ${
                    mode === m ? 'bg-encre text-white' : 'text-encre/60 hover:text-encre'
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setJeton((j) => j + 1)}
              disabled={mode === 'avant'}
              className="flex items-center gap-1 rounded px-2 py-1.5 font-semibold text-encre hover:bg-sol disabled:opacity-40"
              aria-label="Rejouer l'animation"
            >
              <Play className="h-3.5 w-3.5" /> Rejouer
            </button>
            <div className="hidden items-center gap-3 px-1 text-encre/65 sm:flex">
              {mode !== 'apres' && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: COULEUR_NAIF }} />
                  Ordre de saisie
                </span>
              )}
              {mode !== 'avant' && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1 w-4 rounded" style={{ background: COULEUR_OPTIMISE }} />
                  Optimisé
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
