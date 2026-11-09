/**
 * Livreur — la tournée côté livreur, ouverte depuis le lien reçu sur WhatsApp
 * (`#/livreur?f=…`). Pensée pour le téléphone, en plein soleil et d'une main :
 * le prochain arrêt en grand (y aller, appeler, livré / absent), les arrêts
 * restants réordonnables, la ré-optimisation depuis la position actuelle, et
 * le compte-rendu renvoyé au responsable. Tout est enregistré sur l'appareil.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Sparkles,
  UserX,
  Map as IconeCarte,
} from 'lucide-react';
import { Marque } from '../App';
import { BandeauxPwa } from '../components/Pwa';
import { MapView, type MarqueurCarte } from '../components/MapView';
import { Pastille } from '../components/Itineraire';
import { Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { api, ApiError } from '../lib/api';
import { lienWhatsApp } from '../lib/feuilleRoute';
import {
  bilan,
  compteRendu,
  decoderFeuille,
  deplacer,
  detailsPoint,
  ecrireSuivi,
  lienAppel,
  lienNavigation,
  lireSuivi,
  marquer,
  reprendre,
  suiviInitial,
  type FeuilleLivreur,
  type PointFeuille,
  type Suivi,
} from '../lib/suivi';
import type { Arret } from '../types';

const MOTIFS = ['Client absent', 'Injoignable', 'Adresse introuvable', 'Refusé', 'Reporté'];

const versArret = (p: PointFeuille, id: string): Arret => ({ id, label: p.l, lat: p.a, lng: p.o });

/** Position GPS actuelle, ou null (refus, délai dépassé, pas de GPS). */
function positionActuelle(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

export function Livreur() {
  const [params] = useSearchParams();
  const code = params.get('f');
  const [feuille, setFeuille] = useState<FeuilleLivreur | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    setFeuille(null);
    setErreur(false);
    if (!code) return setErreur(true);
    decoderFeuille(code).then(setFeuille, () => setErreur(true));
  }, [code]);

  if (erreur) {
    return (
      <Cadre>
        <div className="feuille m-4 p-6">
          <p className="font-titre text-xl font-semibold">Lien de tournée illisible</p>
          <p className="mt-1 text-encre/60">
            Le lien est incomplet ou abîmé (souvent coupé en le copiant). Demandez au responsable de vous le renvoyer.
          </p>
          <Link to="/" className="btn-secondaire mt-4">Ouvrir RouteBénin</Link>
        </div>
      </Cadre>
    );
  }
  if (!feuille) {
    return (
      <Cadre>
        <div className="flex justify-center p-10"><Spinner className="h-8 w-8" /></div>
      </Cadre>
    );
  }
  return <Tournee feuille={feuille} />;
}

function Cadre({ children, titre, sousTitre }: { children: React.ReactNode; titre?: string; sousTitre?: string }) {
  return (
    <div className="min-h-full bg-sol pb-10">
      <header className="sticky top-0 z-[600] flex items-center gap-3 bg-encre px-4 py-2.5">
        <Marque className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-titre text-lg font-semibold leading-tight text-white">{titre ?? 'RouteBénin'}</p>
          {sousTitre && <p className="truncate text-xs text-white/60">{sousTitre}</p>}
        </div>
      </header>
      <BandeauxPwa />
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}

function Tournee({ feuille }: { feuille: FeuilleLivreur }) {
  const toast = useToast();
  const [suivi, setSuiviEtat] = useState<Suivi>(() => lireSuivi(feuille) ?? suiviInitial(feuille));
  const [motifs, setMotifs] = useState(false);
  const [carte, setCarte] = useState(false);
  const [traitesOuverts, setTraitesOuverts] = useState(false);
  const [reoptimisation, setReoptimisation] = useState(false);

  const setSuivi = (s: Suivi) => {
    setSuiviEtat(s);
    ecrireSuivi(feuille, s);
  };

  const b = bilan(feuille, suivi);
  const prochain = suivi.ordre[0];
  const p = prochain !== undefined ? feuille.p[prochain] : null;
  const traites = Object.entries(suivi.etats)
    .map(([i, e]) => ({ i: Number(i), e }))
    .sort((x, y) => y.e.t - x.e.t);

  const signaler = (statut: 'livre' | 'absent', motif?: string) => {
    if (prochain === undefined) return;
    setSuivi(marquer(suivi, prochain, statut, motif));
    setMotifs(false);
    // Pas de notification : la carte « prochain arrêt » change et la barre avance
    // (annulation possible dans « Déjà traités »).
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Ré-optimise l'ordre des arrêts restants depuis la position actuelle. */
  const reoptimiser = async () => {
    setReoptimisation(true);
    try {
      const gps = await positionActuelle();
      const dernierTraite = traites[0] ? feuille.p[traites[0].i] : null;
      const origine = gps
        ? { id: 'pos', label: 'Ma position', ...gps }
        : dernierTraite
          ? versArret(dernierTraite, 'pos')
          : versArret(feuille.d, 'pos');
      const fin = feuille.b ? feuille.d : feuille.r ?? null;
      const maintenant = new Date();
      const r = await api.optimiser({
        depart: origine,
        destinations: suivi.ordre.map((i) => {
          const pt = feuille.p[i];
          const a = versArret(pt, String(i));
          if (pt.w) a.fenetre = { debut: pt.w[0], fin: pt.w[1] };
          if (pt.c !== undefined) a.colis = pt.c;
          return a;
        }),
        arrivee: fin ? versArret(fin, 'fin') : null,
        minutesParLivraison: feuille.m ?? 5,
        heureDepart: `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`,
      });
      const ordre = r.etapes.map((e) => e.arret.id).filter((id) => id !== 'pos' && id !== 'fin').map(Number);
      if (ordre.length !== suivi.ordre.length) throw new ApiError('Ré-optimisation incomplète.');
      const heures: Record<number, number> = {};
      r.horaires?.passages.forEach((pa, k) => ordre[k] !== undefined && (heures[ordre[k]] = pa.arrivee));
      const change = ordre.some((x, k) => x !== suivi.ordre[k]);
      setSuivi({ ...suivi, ordre, heures });
      toast.succes(
        `${change ? 'Nouvel ordre calculé' : 'L’ordre actuel est déjà le meilleur'} depuis ${gps ? 'votre position' : dernierTraite ? 'le dernier arrêt' : 'le départ'}${r.source === 'osrm' ? '' : ' (distances à vol d’oiseau)'}.`,
      );
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Ré-optimisation impossible pour le moment.');
    } finally {
      setReoptimisation(false);
    }
  };

  const marqueurs = useMemo<MarqueurCarte[]>(
    () => [
      { id: 'd', lat: feuille.d.a, lng: feuille.d.o, label: feuille.d.l, type: 'depart' },
      ...suivi.ordre.map((i) => ({
        id: `p${i}`,
        lat: feuille.p[i].a,
        lng: feuille.p[i].o,
        label: feuille.p[i].l,
        numero: i + 1,
        type: 'etape' as const,
        attenue: i !== prochain,
      })),
      ...(feuille.r ? [{ id: 'r', lat: feuille.r.a, lng: feuille.r.o, label: feuille.r.l, type: 'arrivee' as const }] : []),
    ],
    [feuille, suivi.ordre, prochain],
  );

  const fin = feuille.b ? feuille.d : feuille.r;

  return (
    <Cadre titre={feuille.n} sousTitre={feuille.e}>
      {/* Avancement */}
      <div className="px-4 pt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="chiffre font-semibold">
            {b.livres + b.absents}/{b.total} arrêts traités
          </span>
          <span className="chiffre text-encre/60">
            {b.livres} livré{b.livres > 1 ? 's' : ''}
            {b.absents ? ` · ${b.absents} non livré${b.absents > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-ligne" aria-hidden>
          <div className="bg-gain" style={{ width: `${(b.livres / b.total) * 100}%` }} />
          <div className="bg-attention" style={{ width: `${(b.absents / b.total) * 100}%` }} />
        </div>
      </div>

      {/* Prochain arrêt */}
      {p && prochain !== undefined ? (
        <section className="feuille m-4 overflow-hidden" aria-live="polite">
          <div className="border-b border-ligne bg-zem-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-encre/70">
            Prochain arrêt
          </div>
          <div className="flex gap-3 px-4 pt-4">
            <span className="chiffre flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-encre bg-zem font-titre text-xl font-bold">
              {prochain + 1}
            </span>
            <div className="min-w-0">
              <p className="font-titre text-xl font-semibold leading-snug">{p.l}</p>
              {detailsPoint(p, suivi.heures?.[prochain]).length > 0 && (
                <p className="chiffre mt-0.5 text-sm font-semibold text-encre/65">{detailsPoint(p, suivi.heures?.[prochain]).join(' · ')}</p>
              )}
              {p.n && <p className="mt-2 rounded-md bg-sol px-3 py-2 text-[0.9375rem]">💬 {p.n}</p>}
            </div>
          </div>
          <div className={`grid gap-2 px-4 pt-4 ${p.t ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <a href={lienNavigation(p)} target="_blank" rel="noopener noreferrer" className="btn-encre py-3">
              <Navigation className="h-5 w-5" /> Y aller
            </a>
            {p.t && (
              <a href={lienAppel(p.t)} className="btn-secondaire py-3">
                <Phone className="h-5 w-5" /> Appeler
              </a>
            )}
          </div>
          {!motifs ? (
            <div className="grid grid-cols-[1fr_auto] gap-2 p-4">
              <button type="button" onClick={() => signaler('livre')} className="btn bg-gain py-4 text-lg text-white hover:bg-gain/90">
                <Check className="h-6 w-6" strokeWidth={2.5} /> Livré
              </button>
              <button type="button" onClick={() => setMotifs(true)} className="btn-secondaire px-5 py-4 text-lg">
                <UserX className="h-5 w-5" /> Absent
              </button>
            </div>
          ) : (
            <div className="p-4">
              <p className="etiquette mb-2">Pourquoi pas livré ?</p>
              <div className="flex flex-wrap gap-2">
                {MOTIFS.map((m) => (
                  <button key={m} type="button" onClick={() => signaler('absent', m)} className="btn-secondaire px-3 py-2.5">
                    {m}
                  </button>
                ))}
                <button type="button" onClick={() => setMotifs(false)} className="btn-fantome px-3 py-2.5">
                  Retour
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="feuille m-4 p-5">
          <p className="font-titre text-xl font-semibold">Tournée terminée 🎉</p>
          <p className="mt-1 text-encre/65">
            {b.livres} livraison{b.livres > 1 ? 's' : ''} sur {b.total}
            {b.colisLivres !== b.livres ? ` (${b.colisLivres} colis)` : ''}.
            {fin ? ` Retour : ${fin.l}.` : ''}
          </p>
          {fin && (
            <a href={lienNavigation(fin)} target="_blank" rel="noopener noreferrer" className="btn-encre mt-4 w-full py-3">
              <Navigation className="h-5 w-5" /> {feuille.b ? 'Rentrer au dépôt' : 'Aller à l’arrivée'}
            </a>
          )}
        </section>
      )}

      {/* Compte-rendu */}
      <div className="px-4">
        <a
          href={lienWhatsApp(compteRendu(feuille, suivi))}
          target="_blank"
          rel="noopener noreferrer"
          className={`${b.termine ? 'btn-whatsapp' : 'btn-secondaire'} w-full py-3`}
        >
          <MessageCircle className="h-5 w-5" /> {b.termine ? 'Envoyer le compte-rendu' : 'Envoyer un point d’étape'}
        </a>
      </div>

      {/* Carte */}
      <div className="px-4 pt-3">
        <button type="button" onClick={() => setCarte(!carte)} className="btn-fantome w-full" aria-expanded={carte}>
          <IconeCarte className="h-5 w-5" /> {carte ? 'Masquer la carte' : 'Voir la carte'}
        </button>
        {carte && (
          <div className="feuille relative mt-2 h-72 overflow-hidden">
            <MapView marqueurs={marqueurs} />
          </div>
        )}
      </div>

      {/* Arrêts restants */}
      {suivi.ordre.length > 1 && (
        <section className="feuille m-4">
          <div className="flex items-center justify-between gap-2 border-b border-ligne px-4 py-3">
            <h2 className="text-lg font-semibold">Ensuite ({suivi.ordre.length - 1})</h2>
            <button type="button" onClick={reoptimiser} disabled={reoptimisation} className="btn-secondaire px-3 py-2 text-sm">
              {reoptimisation ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Ré-optimiser
            </button>
          </div>
          <p className="aide border-b border-ligne px-4 py-2">
            Déplacez un arrêt avec les flèches, ou recalculez le meilleur ordre depuis votre position.
          </p>
          <ol className="divide-y divide-ligne">
            {suivi.ordre.slice(1).map((i, k) => {
              const rang = k + 1;
              const pt = feuille.p[i];
              const d = detailsPoint(pt, suivi.heures?.[i]);
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Pastille type="etape" numero={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{pt.l}</p>
                    {d.length > 0 && <p className="chiffre text-xs font-semibold text-encre/55">{d.join(' · ')}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuivi(deplacer(suivi, rang, rang - 1))}
                    aria-label={`Avancer l’arrêt ${i + 1}`}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-encre/50 hover:bg-sol hover:text-encre"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuivi(deplacer(suivi, rang, rang + 1))}
                    disabled={rang === suivi.ordre.length - 1}
                    aria-label={`Reculer l’arrêt ${i + 1}`}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-encre/50 hover:bg-sol hover:text-encre disabled:opacity-25"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Arrêts traités */}
      {traites.length > 0 && (
        <section className="feuille m-4">
          <button
            type="button"
            onClick={() => setTraitesOuverts(!traitesOuverts)}
            aria-expanded={traitesOuverts}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <h2 className="text-lg font-semibold">Déjà traités ({traites.length})</h2>
            <ChevronDown className={`h-5 w-5 transition-transform ${traitesOuverts ? 'rotate-180' : ''}`} />
          </button>
          {traitesOuverts && (
            <ul className="divide-y divide-ligne border-t border-ligne">
              {traites.map(({ i, e }) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`chiffre flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${e.s === 'livre' ? 'bg-gain' : 'bg-attention'}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{feuille.p[i].l}</p>
                    <p className="chiffre text-xs text-encre/55">
                      {e.s === 'livre' ? 'Livré' : e.r ?? 'Non livré'} à{' '}
                      {new Date(e.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {e.s === 'absent' && (
                    <button type="button" onClick={() => setSuivi(reprendre(suivi, i, true))} className="btn-fantome px-2 py-2 text-sm">
                      Repasser
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuivi(reprendre(suivi, i))}
                    aria-label={`Annuler le statut de l’arrêt ${i + 1}`}
                    title="Annuler"
                    className="flex h-9 w-9 items-center justify-center rounded-md text-encre/45 hover:bg-sol hover:text-encre"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Cadre>
  );
}
