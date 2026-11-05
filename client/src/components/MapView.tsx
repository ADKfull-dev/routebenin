/**
 * MapView — carte interactive Leaflet.
 * Affiche des marqueurs numérotés, un tracé d'itinéraire (réel OSRM ou lignes
 * droites de repli) et permet d'ajouter un point par clic sur la carte.
 */
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export interface MarqueurCarte {
  id: string;
  lat: number;
  lng: number;
  label: string;
  numero?: number;
  type: 'depart' | 'arrivee' | 'etape' | 'simple';
}

interface Props {
  marqueurs: MarqueurCarte[];
  /** Tracé optimisé au format [lat, lng]. */
  trace?: [number, number][] | null;
  onClickCarte?: (lat: number, lng: number) => void;
}

const CENTRE_COTONOU: [number, number] = [6.37, 2.42];

function iconeMarqueur(m: MarqueurCarte): L.DivIcon {
  const couleur =
    m.type === 'depart' ? '#0B1F3A' : m.type === 'arrivee' ? '#DC2626' : '#2563EB';
  const contenu =
    m.type === 'depart' ? 'D' : m.type === 'arrivee' ? 'A' : String(m.numero ?? '');
  const html = `
    <div style="
      display:flex;align-items:center;justify-content:center;
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${couleur};color:#fff;font-weight:700;font-size:13px;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">
      <span style="transform:rotate(45deg)">${contenu}</span>
    </div>`;
  return L.divIcon({
    className: 'marqueur-numero',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
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

/** Capte les clics sur la carte pour ajouter un point. */
function GestionClic({ onClickCarte }: { onClickCarte?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClickCarte?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapView({ marqueurs, trace, onClickCarte }: Props) {
  // Repli : si pas de tracé OSRM, relier les marqueurs par des lignes droites.
  const traceDroite = useMemo<[number, number][]>(
    () => marqueurs.map((m) => [m.lat, m.lng]),
    [marqueurs],
  );
  const ligne = trace && trace.length > 1 ? trace : traceDroite;

  return (
    <MapContainer center={CENTRE_COTONOU} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {ligne.length > 1 && (
        <Polyline
          positions={ligne}
          pathOptions={{ color: '#2563EB', weight: 5, opacity: 0.85 }}
        />
      )}
      {marqueurs.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={iconeMarqueur(m)} title={m.label} />
      ))}
      <AjusterVue marqueurs={marqueurs} />
      <GestionClic onClickCarte={onClickCarte} />
    </MapContainer>
  );
}
