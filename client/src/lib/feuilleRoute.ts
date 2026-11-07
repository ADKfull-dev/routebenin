/**
 * feuilleRoute — export de la tournée optimisée pour le livreur :
 *  - texte prêt à partager (WhatsApp, SMS, copier-coller) ;
 *  - liens de navigation Google Maps, découpés en tronçons ;
 *  - feuille de route imprimable (enregistrable en PDF via le navigateur).
 */
import type { Arret, ResultatOptimisation } from '../types';
import { formatDistance, formatDuree, formatPourcent } from './format';

export interface InfosFeuille {
  resultat: ResultatOptimisation;
  /** true : retour au départ en fin de tournée. */
  boucle: boolean;
  nom?: string | null;
  entreprise?: string | null;
}

/**
 * Google Maps n'accepte que 3 étapes intermédiaires par lien sur mobile
 * (9 sur ordinateur). Le livreur étant sur téléphone, on découpe la tournée
 * en tronçons de 5 points (départ + 3 étapes + fin), chaque tronçon
 * commençant là où le précédent s'arrête.
 */
const POINTS_PAR_TRONCON = 5;

const coord = (a: Arret) => `${a.lat.toFixed(6)},${a.lng.toFixed(6)}`;

/** Points dans l'ordre de passage (retour au départ ajouté en boucle). */
export function parcours({ resultat, boucle }: InfosFeuille): Arret[] {
  const pts = resultat.etapes.map((e) => e.arret);
  return boucle && pts.length > 1 ? [...pts, pts[0]] : pts;
}

export interface Troncon {
  lien: string;
  /** Numéros d'étape couverts (0 = départ). */
  de: number;
  a: number;
}

export function liensGoogleMaps(infos: InfosFeuille): Troncon[] {
  const pts = parcours(infos);
  const troncons: Troncon[] = [];
  for (let debut = 0; debut < pts.length - 1; debut += POINTS_PAR_TRONCON - 1) {
    const fin = Math.min(debut + POINTS_PAR_TRONCON - 1, pts.length - 1);
    const morceau = pts.slice(debut, fin + 1);
    const params = new URLSearchParams({
      api: '1',
      travelmode: 'driving',
      origin: coord(morceau[0]),
      destination: coord(morceau[morceau.length - 1]),
    });
    const etapes = morceau.slice(1, -1).map(coord).join('|');
    if (etapes) params.set('waypoints', etapes);
    troncons.push({ lien: `https://www.google.com/maps/dir/?${params.toString()}`, de: debut, a: fin });
  }
  return troncons;
}

/** Lien Google Maps vers un point précis. */
export const lienPoint = (a: Arret) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord(a))}`;

/** Libellé court : on garde les 2 premiers segments d'une adresse Nominatim. */
export function libelleCourt(label: string): string {
  return label.split(',').slice(0, 2).map((s) => s.trim()).join(', ');
}

/** Message texte de la feuille de route (WhatsApp / SMS / presse-papiers). */
export function texteFeuille(infos: InfosFeuille): string {
  const { resultat, boucle, nom, entreprise } = infos;
  const pts = parcours(infos);
  const l: string[] = [];
  l.push(`🚚 *${nom?.trim() || 'Feuille de route'}*${entreprise ? ` — ${entreprise}` : ''}`);
  l.push(
    `📏 ${formatDistance(resultat.distanceOptimisee)}` +
      (resultat.dureeSecondes !== null ? ` · ⏱️ ~${formatDuree(resultat.dureeSecondes)}` : '') +
      ` · ${resultat.nombreDestinations} livraison${resultat.nombreDestinations > 1 ? 's' : ''}`,
  );
  if (resultat.gainPourcent >= 0.5) {
    l.push(`✅ Ordre optimisé : −${formatPourcent(resultat.gainPourcent)} (${formatDistance(resultat.gainMetres)} économisés)`);
  }
  l.push('');
  pts.forEach((a, i) => {
    const estDepart = i === 0;
    const estRetour = boucle && i === pts.length - 1;
    const prefixe = estDepart ? '🏁 Départ' : estRetour ? '🔁 Retour' : !boucle && i === pts.length - 1 ? `🏁 ${i}. Arrivée` : `${i}.`;
    l.push(`${prefixe} ${libelleCourt(a.label)}`);
  });
  const troncons = liensGoogleMaps(infos);
  l.push('');
  l.push(troncons.length > 1 ? '🧭 Navigation (Google Maps, par tronçon) :' : '🧭 Navigation (Google Maps) :');
  troncons.forEach((t, i) => {
    l.push(troncons.length > 1 ? `${i + 1}) étapes ${t.de}→${t.a} : ${t.lien}` : t.lien);
  });
  l.push('');
  l.push('— Optimisé avec RouteBénin');
  return l.join('\n');
}

export const lienWhatsApp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Document HTML autonome de la feuille de route, mis en page pour l'impression A4. */
export function htmlFeuille(infos: InfosFeuille): string {
  const { resultat, boucle, nom, entreprise } = infos;
  const pts = parcours(infos);
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lignes = pts
    .map((a, i) => {
      const estDepart = i === 0;
      const estRetour = boucle && i === pts.length - 1;
      const estArrivee = !boucle && i === pts.length - 1 && i > 0;
      const repere = estDepart ? 'D' : estRetour ? 'R' : String(i);
      const role = estDepart ? 'Départ' : estRetour ? 'Retour au départ' : estArrivee ? 'Arrivée' : '';
      const livrable = !estDepart && !estRetour;
      return `<tr>
        <td class="num"><span class="pastille${estDepart || estRetour ? ' sombre' : ''}">${repere}</span></td>
        <td><div class="adr">${esc(a.label)}</div>${role ? `<div class="role">${role}</div>` : ''}
            <div class="gps">${a.lat.toFixed(5)}, ${a.lng.toFixed(5)} · <a href="${lienPoint(a)}">ouvrir la carte</a></div></td>
        <td class="case">${livrable ? '<span class="cb"></span>' : ''}</td>
        <td class="obs"></td>
      </tr>`;
    })
    .join('');
  const troncons = liensGoogleMaps(infos)
    .map((t, i, tout) => `<li><a href="${t.lien}">${tout.length > 1 ? `Tronçon ${i + 1} — étapes ${t.de} à ${t.a}` : 'Itinéraire complet'}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(nom?.trim() || 'Feuille de route')} — RouteBénin</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #171B3F; margin: 0; padding: 24px; background: #fff; font-size: 13px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #171B3F; padding-bottom: 10px; }
  h1 { font-size: 20px; margin: 0; }
  .sous { color: #5b6574; margin-top: 2px; }
  .marque { font-weight: 700; color: #171B3F; text-align: right; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
  .kpi { border: 1px solid #E6E8EC; border-radius: 8px; padding: 8px 10px; }
  .kpi b { display: block; font-size: 16px; margin-top: 2px; }
  .kpi span { color: #5b6574; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #5b6574; font-weight: 600; border-bottom: 1px solid #171B3F; padding: 6px 6px; }
  td { border-bottom: 1px solid #E6E8EC; padding: 8px 6px; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { width: 40px; }
  .pastille { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; align-items: center; justify-content: center; background: #FFC414; color: #171B3F; border: 1.5px solid #171B3F; font-weight: 700; font-size: 12px; }
  .pastille.sombre { background: #171B3F; }
  .adr { font-weight: 600; }
  .role { color: #171B3F; font-size: 11px; font-weight: 600; }
  .gps { color: #5b6574; font-size: 11px; margin-top: 2px; }
  .gps a, li a { color: #171B3F; }
  .case { width: 56px; text-align: center; }
  .cb { display: inline-block; width: 18px; height: 18px; border: 1.5px solid #171B3F; border-radius: 4px; }
  .obs { width: 32%; }
  .nav { margin-top: 16px; }
  .nav ul { margin: 6px 0 0; padding-left: 18px; }
  .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
  .signature div { border-top: 1px solid #171B3F; padding-top: 4px; color: #5b6574; font-size: 11px; }
  .note { margin-top: 18px; color: #8a93a0; font-size: 10.5px; }
  .actions { margin-bottom: 16px; display: flex; gap: 8px; }
  .actions button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #171B3F; background: #FFC414; color: #171B3F; font-weight: 600; cursor: pointer; }
  .actions button.sec { background: #fff; color: #171B3F; }
  @media print { body { padding: 0; } .actions { display: none; } a { text-decoration: none; } }
  @media (max-width: 640px) { body { padding: 16px; } .kpis { grid-template-columns: repeat(2, 1fr); } .obs { display: none; } }
</style></head>
<body>
  <div class="actions"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button><button class="sec" onclick="window.close()">Fermer</button></div>
  <header>
    <div><h1>${esc(nom?.trim() || 'Feuille de route')}</h1><div class="sous">${esc(date)}${entreprise ? ` · ${esc(entreprise)}` : ''}</div></div>
    <div class="marque">RouteBénin</div>
  </header>
  <div class="kpis">
    <div class="kpi"><span>Livraisons</span><b>${resultat.nombreDestinations}</b></div>
    <div class="kpi"><span>Distance</span><b>${formatDistance(resultat.distanceOptimisee)}</b></div>
    <div class="kpi"><span>Durée estimée</span><b>${formatDuree(resultat.dureeSecondes)}</b></div>
    <div class="kpi"><span>Économie</span><b>${resultat.gainPourcent >= 0.5 ? `−${formatPourcent(resultat.gainPourcent)}` : '—'}</b></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Adresse</th><th style="text-align:center">Livré</th><th>Observations</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <div class="nav"><b>Navigation Google Maps</b><ul>${troncons}</ul></div>
  <div class="signature"><div>Livreur</div><div>Visa responsable</div></div>
  <p class="note">${resultat.source === 'osrm' ? 'Distances routières réelles (OSRM).' : 'Distances estimées à vol d’oiseau.'} Données cartographiques © OpenStreetMap.</p>
</body></html>`;
}
