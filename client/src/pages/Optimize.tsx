/**
 * Optimize — page centrale : saisie de la tournée (gauche) + carte (droite),
 * puis résultat d'optimisation.
 */
import { useEffect, useMemo, useState } from 'react';
import { Flag, Navigation, Sparkles, Wand2, RotateCcw, Save, Plus } from 'lucide-react';
import { AddressSearch } from '../components/AddressSearch';
import { StopList } from '../components/StopList';
import { MapView, type MarqueurCarte } from '../components/MapView';
import { ResultCard } from '../components/ResultCard';
import { Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { api, ApiError } from '../lib/api';
import type { Arret, ResultatOptimisation } from '../types';
import { DEPART_DEMO, DESTINATIONS_DEMO } from '../lib/demoCotonou';
import { traceInitial as calculerTraceInitial, traceOptimise } from '../lib/traces';

const memeLieu = (a: Arret, b: Arret) =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

export function Optimize() {
  const toast = useToast();
  const [depart, setDepart] = useState<Arret | null>(null);
  const [destinations, setDestinations] = useState<Arret[]>([]);
  const [arrivee, setArrivee] = useState<Arret | null>(null);

  const [resultat, setResultat] = useState<ResultatOptimisation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [nomTournee, setNomTournee] = useState('');
  const [sauvegarde, setSauvegarde] = useState(false);
  const [prefererOsrm, setPrefererOsrm] = useState(true);

  // Récupère la préférence « distances routières » définie dans les paramètres.
  useEffect(() => {
    let annule = false;
    api
      .obtenirProfil()
      .then((p) => !annule && setPrefererOsrm(p.prefererOsrm))
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const nbPoints = (depart ? 1 : 0) + destinations.length;
  const peutOptimiser = depart !== null && destinations.length >= 1;

  const arriveeDistincte = arrivee !== null && depart !== null && !memeLieu(arrivee, depart);

  // Marqueurs + tracé pour la carte (selon qu'on a un résultat ou non).
  const { marqueurs, trace, traceInitial } = useMemo<{
    marqueurs: MarqueurCarte[];
    trace: [number, number][] | null;
    traceInitial: [number, number][] | null;
  }>(() => {
    if (resultat) {
      const etapes = resultat.etapes;
      const m: MarqueurCarte[] = etapes.map((e, idx) => {
        const estDepart = idx === 0;
        const estArrivee = arriveeDistincte && idx === etapes.length - 1;
        return {
          id: `${e.arret.id}-${idx}`,
          lat: e.arret.lat,
          lng: e.arret.lng,
          label: e.arret.label,
          numero: estDepart ? undefined : idx,
          type: estDepart ? 'depart' : estArrivee ? 'arrivee' : 'etape',
        };
      });
      // Comparaison avant/après seulement s'il y a un vrai gain à montrer.
      const avecComparaison = depart !== null && resultat.gainPourcent >= 0.5;
      return {
        marqueurs: m,
        trace: traceOptimise(resultat, !arriveeDistincte),
        traceInitial: avecComparaison
          ? calculerTraceInitial(resultat, depart, destinations, arrivee)
          : null,
      };
    }

    // Avant optimisation : départ + destinations (ordre de saisie) + arrivée.
    const m: MarqueurCarte[] = [];
    if (depart) m.push({ id: depart.id, lat: depart.lat, lng: depart.lng, label: depart.label, type: 'depart' });
    destinations.forEach((d, i) =>
      m.push({ id: d.id, lat: d.lat, lng: d.lng, label: d.label, numero: i + 1, type: 'etape' }),
    );
    if (arriveeDistincte && arrivee)
      m.push({ id: arrivee.id, lat: arrivee.lat, lng: arrivee.lng, label: arrivee.label, type: 'arrivee' });
    return { marqueurs: m, trace: null, traceInitial: null };
  }, [resultat, depart, destinations, arrivee, arriveeDistincte]);

  const reinitialiserResultat = () => {
    setResultat(null);
    setNomTournee('');
  };

  const ajouterDestination = (a: Arret) => {
    setDestinations((d) => [...d, a]);
    reinitialiserResultat();
  };

  const supprimerDestination = (id: string) => {
    setDestinations((d) => d.filter((x) => x.id !== id));
    reinitialiserResultat();
  };

  const clicCarte = (lat: number, lng: number) => {
    const point: Arret = {
      id: `clic-${Date.now()}`,
      label: `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng,
    };
    if (!depart) {
      setDepart(point);
    } else {
      ajouterDestination(point);
    }
  };

  const utiliserMaPosition = () => {
    if (!navigator.geolocation) {
      toast.erreur('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDepart({
          id: `pos-${Date.now()}`,
          label: 'Ma position actuelle',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        reinitialiserResultat();
        toast.succes('Position actuelle définie comme départ.');
      },
      () => toast.erreur('Impossible d’obtenir votre position.'),
    );
  };

  const chargerExemple = () => {
    setDepart(DEPART_DEMO);
    setDestinations(DESTINATIONS_DEMO);
    setArrivee(null);
    reinitialiserResultat();
    toast.info('Exemple chargé : 14 adresses de Cotonou et environs.');
  };

  const toutEffacer = () => {
    setDepart(null);
    setDestinations([]);
    setArrivee(null);
    reinitialiserResultat();
  };

  const optimiser = async () => {
    if (!peutOptimiser || !depart) return;
    setChargement(true);
    setResultat(null);
    try {
      const r = await api.optimiser({ depart, destinations, arrivee, prefererOsrm });
      setResultat(r);
      if (r.source === 'haversine') {
        toast.info('Itinéraire estimé à vol d’oiseau (service routier indisponible).');
      } else {
        toast.succes(`Tournée optimisée : ${Math.round(r.gainPourcent)} % de distance en moins.`);
      }
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Optimisation impossible.');
    } finally {
      setChargement(false);
    }
  };

  const sauvegarder = async () => {
    if (!resultat || !depart) return;
    const nom = nomTournee.trim();
    if (!nom) {
      toast.erreur('Donnez un nom à la tournée avant de l’enregistrer.');
      return;
    }
    setSauvegarde(true);
    try {
      await api.sauvegarderTournee({ nom, depart, arrivee, destinations, resultat });
      toast.succes('Tournée enregistrée dans l’historique.');
      setNomTournee('');
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.');
    } finally {
      setSauvegarde(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:h-[100dvh] md:flex-row md:p-6">
      {/* Panneau de saisie / résultat */}
      <div className="flex w-full flex-col gap-4 overflow-y-auto md:w-[400px] md:shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Nouvelle tournée</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ajoutez vos points, puis lancez l’optimisation.
          </p>
        </div>

        {!resultat ? (
          <>
            {/* Étape 1 — Départ */}
            <section className="carte p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="etiquette flex items-center gap-2">
                  <Flag className="h-4 w-4 text-nuit dark:text-electrique" /> Point de départ
                </label>
                <button type="button" onClick={utiliserMaPosition} className="btn-fantome px-2 py-1 text-xs">
                  <Navigation className="h-3.5 w-3.5" /> Ma position
                </button>
              </div>
              {depart ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-nuit/5 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="truncate text-slate-700 dark:text-slate-200" title={depart.label}>
                    {depart.label}
                  </span>
                  <button
                    onClick={() => {
                      setDepart(null);
                      reinitialiserResultat();
                    }}
                    className="text-xs text-electrique hover:underline"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <AddressSearch onSelectionner={(a) => { setDepart(a); reinitialiserResultat(); }} placeholder="Adresse de départ…" />
              )}
            </section>

            {/* Étape 2 — Destinations */}
            <section className="carte p-4">
              <label className="etiquette mb-2 flex items-center gap-2">
                <Plus className="h-4 w-4 text-electrique" /> Destinations ({destinations.length})
              </label>
              <AddressSearch onSelectionner={ajouterDestination} placeholder="Ajouter une destination…" />
              <p className="mt-2 text-xs text-nuit/45">
                {destinations.length > 0 && destinations.length < 4
                  ? "Astuce : ajoutez 4 destinations ou plus — c'est là que l'optimisation réduit vraiment la distance."
                  : 'Astuce : cliquez sur la carte pour ajouter un point.'}
              </p>
              {destinations.length > 0 && (
                <div className="mt-3">
                  <StopList
                    destinations={destinations}
                    onReordonner={(n) => { setDestinations(n); reinitialiserResultat(); }}
                    onSupprimer={supprimerDestination}
                  />
                </div>
              )}
            </section>

            {/* Étape 3 — Arrivée (optionnelle) */}
            <section className="carte p-4">
              <label className="etiquette mb-2 flex items-center gap-2">
                <Flag className="h-4 w-4 text-alerte" /> Arrivée (optionnel)
              </label>
              {arrivee ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-alerte/5 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-200" title={arrivee.label}>
                    {arrivee.label}
                  </span>
                  <button onClick={() => { setArrivee(null); reinitialiserResultat(); }} className="text-xs text-electrique hover:underline">
                    Retirer
                  </button>
                </div>
              ) : (
                <AddressSearch onSelectionner={(a) => { setArrivee(a); reinitialiserResultat(); }} placeholder="Par défaut : retour au départ" />
              )}
            </section>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button onClick={optimiser} disabled={!peutOptimiser || chargement} className="btn-primaire w-full py-3 text-base">
                {chargement ? <Spinner /> : <Wand2 className="h-5 w-5" />}
                {chargement ? 'Optimisation…' : 'Optimiser ma tournée'}
              </button>
              {!peutOptimiser && (
                <p className="text-center text-xs text-slate-400">
                  Ajoutez un départ et au moins une destination (minimum 2 points).
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={chargerExemple} className="btn-secondaire flex-1">
                  <Sparkles className="h-4 w-4" /> Charger un exemple
                </button>
                {nbPoints > 0 && (
                  <button onClick={toutEffacer} className="btn-fantome" aria-label="Tout effacer">
                    <RotateCcw className="h-4 w-4" /> Effacer
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <ResultCard resultat={resultat} />
            {/* Enregistrement */}
            <section className="carte p-4">
              <label htmlFor="nom-tournee" className="etiquette mb-2">
                Enregistrer cette tournée
              </label>
              <div className="flex gap-2">
                <input
                  id="nom-tournee"
                  className="champ"
                  placeholder="Ex. : Livraisons du matin"
                  value={nomTournee}
                  onChange={(e) => setNomTournee(e.target.value)}
                  maxLength={120}
                />
                <button onClick={sauvegarder} disabled={sauvegarde} className="btn-primaire shrink-0">
                  {sauvegarde ? <Spinner /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </section>
            <button onClick={reinitialiserResultat} className="btn-secondaire w-full">
              <RotateCcw className="h-4 w-4" /> Modifier la tournée
            </button>
          </>
        )}
      </div>

      {/* Carte */}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
        <MapView
          marqueurs={marqueurs}
          trace={trace}
          traceInitial={traceInitial}
          onClickCarte={resultat ? undefined : clicCarte}
        />
        {marqueurs.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center px-4">
            <div className="pointer-events-auto rounded-xl bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-carte dark:bg-nuit-600/95 dark:text-slate-300">
              Cliquez sur la carte pour placer votre point de départ.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
