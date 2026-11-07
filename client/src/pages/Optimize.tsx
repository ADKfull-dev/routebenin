/**
 * Optimize — page centrale : saisie de la tournée (gauche) + carte (droite),
 * puis résultat d'optimisation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigation, Wand2, Save, Plus, Minus, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AddressSearch } from '../components/AddressSearch';
import { StopList } from '../components/StopList';
import { MapView, type MarqueurCarte } from '../components/MapView';
import { ResultCard } from '../components/ResultCard';
import { ExportActions } from '../components/ExportActions';
import { LivreursPanel } from '../components/LivreursPanel';
import { Spinner, SECTION } from '../components/ui';
import { Etape, Itineraire } from '../components/Itineraire';
import { libelleCourt } from '../lib/feuilleRoute';
import { useToast } from '../components/Toast';
import { api, ApiError } from '../lib/api';
import type { Arret, CritereLivreurs, ResultatOptimisation } from '../types';
import { DEPART_DEMO, DESTINATIONS_DEMO, DEPART_ZOU, DESTINATIONS_ZOU } from '../lib/demoCotonou';
import { chercherLieux } from '../lib/lieuxBenin';
import { traceInitial as calculerTraceInitial, traceOptimise, carteMultiLivreurs } from '../lib/traces';
import { NOMBRE_MAX_LIVREURS } from '../lib/couleurs';
import { MINUTES_PAR_LIVRAISON_DEFAUT } from '../lib/duree';

const CLE_PLANNING = 'routebenin.planning';
function lirePlanning(): { heureDepart: string; capacite: number | null } {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PLANNING) ?? '{}') as { heureDepart?: string; capacite?: number | null };
    return { heureDepart: p.heureDepart || '08:00', capacite: p.capacite ?? null };
  } catch {
    return { heureDepart: '08:00', capacite: null };
  }
}
function ecrirePlanning(p: { heureDepart: string; capacite: number | null }) {
  try {
    localStorage.setItem(CLE_PLANNING, JSON.stringify(p));
  } catch {
    /* stockage indisponible : on garde les valeurs pour cette session */
  }
}
import type { TraceCarte } from '../components/MapView';

const memeLieu = (a: Arret, b: Arret) =>
  Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

export function Optimize() {
  const toast = useToast();
  const [depart, setDepart] = useState<Arret | null>(null);
  const [destinations, setDestinations] = useState<Arret[]>([]);
  const [arriveeSaisie, setArrivee] = useState<Arret | null>(null);
  const [nbLivreurs, setNbLivreurs] = useState(1);
  const [livreurActif, setLivreurActif] = useState<number | null>(null);
  const [critere, setCritere] = useState<CritereLivreurs>('equilibre');
  // Heure de départ et capacité : retenues d'une tournée à l'autre sur cet appareil.
  const [heureDepart, setHeureDepart] = useState(() => lirePlanning().heureDepart);
  const [capacite, setCapacite] = useState<number | null>(() => lirePlanning().capacite);
  useEffect(() => ecrirePlanning({ heureDepart, capacite }), [heureDepart, capacite]);
  // En multi-livreurs, chacun revient au départ : l'arrivée est ignorée.
  const arrivee = nbLivreurs > 1 ? null : arriveeSaisie;

  const [resultat, setResultat] = useState<ResultatOptimisation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [nomTournee, setNomTournee] = useState('');
  const [sauvegarde, setSauvegarde] = useState(false);
  const [prefererOsrm, setPrefererOsrm] = useState(true);
  const [minutesParLivraison, setMinutesParLivraison] = useState(MINUTES_PAR_LIVRAISON_DEFAUT);
  const [centreVille, setCentreVille] = useState<[number, number] | null>(null);
  const panneauRef = useRef<HTMLDivElement>(null);

  // À l'affichage d'un résultat, revenir en haut du panneau : sinon il reste
  // défilé à la hauteur du bouton « Optimiser » et le gain + l'envoi WhatsApp
  // sont hors de l'écran.
  useEffect(() => {
    const panneau = panneauRef.current;
    if (!resultat || !panneau) return;
    panneau.scrollTop = 0; // ordinateur : le panneau défile seul
    window.scrollTo({ top: 0 }); // mobile : la carte (en haut) montre le trajet
  }, [resultat]);

  // Récupère la préférence « distances routières » définie dans les paramètres.
  useEffect(() => {
    let annule = false;
    api
      .obtenirProfil()
      .then((p) => {
        if (annule) return;
        setPrefererOsrm(p.prefererOsrm);
        setMinutesParLivraison(p.minutesParLivraison ?? MINUTES_PAR_LIVRAISON_DEFAUT);
        // Carte centrée sur la ville du profil (Paramètres), où qu'elle soit au Bénin.
        if (p.ville?.trim()) {
          chercherLieux(p.ville, { limite: 1 }).then(([l]) => !annule && l && setCentreVille([l.lat, l.lng]));
        }
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const nbPoints = (depart ? 1 : 0) + destinations.length;
  const peutOptimiser = depart !== null && destinations.length >= 1;

  const arriveeDistincte = arrivee !== null && depart !== null && !memeLieu(arrivee, depart);

  // Marqueurs + tracé pour la carte (selon qu'on a un résultat ou non).
  const { marqueurs, trace, traceInitial, traces } = useMemo<{
    marqueurs: MarqueurCarte[];
    trace: [number, number][] | null;
    traceInitial: [number, number][] | null;
    traces?: TraceCarte[];
  }>(() => {
    if (resultat?.livreurs && resultat.livreurs.length > 1) {
      return { ...carteMultiLivreurs(resultat, livreurActif), trace: null, traceInitial: null };
    }
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
  }, [resultat, depart, destinations, arrivee, arriveeDistincte, livreurActif]);

  const reinitialiserResultat = () => {
    setResultat(null);
    setLivreurActif(null);
    setNomTournee('');
  };

  const ajouterDestination = (a: Arret) => {
    setDestinations((d) => [...d, a]);
    reinitialiserResultat();
  };

  const modifierDestination = (id: string, modif: Partial<Pick<Arret, 'fenetre' | 'colis'>>) => {
    setDestinations((d) => d.map((x) => (x.id === id ? { ...x, ...modif } : x)));
    reinitialiserResultat();
  };

  // Chargement : colis à livrer et nombre minimal de livreurs pour la capacité.
  const totalColis = destinations.reduce((s, d) => s + (d.colis ?? 1), 0);
  const livreursNecessaires = capacite ? Math.ceil(totalColis / capacite) : 1;
  const capaciteInsuffisante = capacite !== null && livreursNecessaires > nbLivreurs;
  const livreursPossibles = livreursNecessaires <= Math.min(NOMBRE_MAX_LIVREURS, destinations.length);

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

  const chargerExemple = (exemple: 'cotonou' | 'zou' = 'cotonou') => {
    const zou = exemple === 'zou';
    setDepart(zou ? DEPART_ZOU : DEPART_DEMO);
    setDestinations(zou ? DESTINATIONS_ZOU : DESTINATIONS_DEMO);
    setArrivee(null);
    reinitialiserResultat();
    toast.info(
      zou
        ? 'Exemple chargé : 10 livraisons entre le Zou et les Collines, au départ de Bohicon.'
        : 'Exemple chargé : 14 livraisons à Cotonou et environs.',
    );
  };

  // Lien « Essayer l'exemple » du tableau de bord : /optimiser?exemple=1
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('exemple') === null) return;
    chargerExemple(params.get('exemple') === 'zou' ? 'zou' : 'cotonou');
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setLivreurActif(null);
    try {
      const r = await api.optimiser({
        depart,
        destinations,
        arrivee,
        prefererOsrm,
        nombreLivreurs: Math.min(nbLivreurs, destinations.length),
        critereLivreurs: critere,
        minutesParLivraison,
        heureDepart,
        capaciteVehicule: capacite,
      });
      setResultat(r);
      if (r.source === 'haversine') {
        toast.info(
          navigator.onLine
            ? 'Itinéraire estimé à vol d’oiseau (service routier indisponible).'
            : 'Hors ligne : itinéraire estimé à vol d’oiseau.',
        );
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

  const actionsSaisie = (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-encre/60">Exemple :</span>
      <button type="button" onClick={() => chargerExemple('cotonou')} className="lien">
        Cotonou
      </button>
      <button type="button" onClick={() => chargerExemple('zou')} className="lien">
        Zou et Collines
      </button>
      {nbPoints > 0 && (
        <button type="button" onClick={toutEffacer} className="font-semibold text-encre/60 hover:text-alerte">
          Tout effacer
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col md:h-[100dvh] md:flex-row">
      {/* Carte : en haut sur mobile, à droite sur ordinateur */}
      <div className="relative h-[44vh] min-h-[280px] md:order-2 md:h-auto md:flex-1">
        <MapView
          marqueurs={marqueurs}
          trace={trace}
          traceInitial={traceInitial}
          traces={traces}
          onClickCarte={resultat ? undefined : clicCarte}
          centre={centreVille}
        />
        {marqueurs.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center px-4">
            <p className="rounded-md bg-encre px-3.5 py-2 text-sm font-medium text-white shadow-pop">
              Touchez la carte pour placer le point de départ
            </p>
          </div>
        )}
      </div>

      {/* Panneau de saisie / résultat */}
      <div
        ref={panneauRef}
        className="flex flex-col bg-white md:order-1 md:w-[440px] md:shrink-0 md:overflow-y-auto md:shadow-panneau"
      >
        {!resultat ? (
          <>
            <div className="px-5 pb-2 pt-6">
              <h1 className="font-titre text-2xl font-bold tracking-tight">Nouvelle tournée</h1>
              <p className="mt-1 text-encre/60">Saisissez le départ et les adresses à livrer, dans n’importe quel ordre.</p>
              <div className="mt-3">{actionsSaisie}</div>
            </div>

            {/* Itinéraire : départ → livraisons → arrivée */}
            <section className={SECTION}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Itinéraire</h2>
                <span className="chiffre aide">
                  {destinations.length} livraison{destinations.length > 1 ? 's' : ''}
                </span>
              </div>
              <Itineraire>
                <Etape
                  type="depart"
                  premier
                  avecChamp={!depart}
                  pointille={destinations.length === 0}
                  actions={
                    !depart && (
                      <button type="button" onClick={utiliserMaPosition} className="btn-fantome ml-1 px-2.5 py-2 text-sm" title="Utiliser ma position">
                        <Navigation className="h-4 w-4" /> <span className="hidden sm:inline">Ma position</span>
                      </button>
                    )
                  }
                >
                  {depart ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[0.9375rem] font-semibold" title={depart.label}>
                        {libelleCourt(depart.label)}
                      </p>
                      <button type="button" onClick={() => { setDepart(null); reinitialiserResultat(); }} className="lien shrink-0 text-sm">
                        Changer
                      </button>
                    </div>
                  ) : (
                    <AddressSearch onSelectionner={(a) => { setDepart(a); reinitialiserResultat(); }} placeholder="Départ : dépôt, boutique…" />
                  )}
                </Etape>

                <StopList
                  destinations={destinations}
                  onReordonner={(n) => { setDestinations(n); reinitialiserResultat(); }}
                  onSupprimer={supprimerDestination}
                  onModifier={modifierDestination}
                />

                <Etape type="ajout" avecChamp pointilleHaut={destinations.length === 0} pointille dernier={nbLivreurs > 1}>
                  <AddressSearch onSelectionner={ajouterDestination} placeholder="Ajouter une livraison…" proche={depart} />
                </Etape>

                {nbLivreurs === 1 && (
                  <Etape type="arrivee" avecChamp={!arrivee} pointilleHaut dernier>
                    {arrivee ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[0.9375rem] font-semibold" title={arrivee.label}>
                          {libelleCourt(arrivee.label)}
                        </p>
                        <button type="button" onClick={() => { setArrivee(null); reinitialiserResultat(); }} className="lien shrink-0 text-sm">
                          Retirer
                        </button>
                      </div>
                    ) : (
                      <AddressSearch onSelectionner={(a) => { setArrivee(a); reinitialiserResultat(); }} placeholder="Arrivée : retour au départ si vide" proche={depart} />
                    )}
                  </Etape>
                )}
              </Itineraire>
              <p className="aide mt-3 pl-10">
                {destinations.length > 0 && destinations.length < 4
                  ? 'L’ordre de passage compte à partir de 4 livraisons : c’est là que la distance baisse vraiment.'
                  : destinations.length === 0
                    ? 'Vous pouvez aussi toucher la carte pour ajouter un point.'
                    : 'Touchez l’horloge d’une livraison pour lui donner un créneau ou un nombre de colis.'}
              </p>
            </section>

            {/* Horaires et chargement (fenêtres horaires, capacité) */}
            <section className={SECTION}>
              <h2 className="text-lg font-semibold">Horaires et chargement</h2>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="heure-depart" className="etiquette mb-1.5">Départ à</label>
                  <input
                    id="heure-depart"
                    type="time"
                    className="champ chiffre"
                    value={heureDepart}
                    onChange={(e) => { setHeureDepart(e.target.value || '08:00'); reinitialiserResultat(); }}
                  />
                </div>
                <div>
                  <label htmlFor="capacite" className="etiquette mb-1.5">Colis par livreur</label>
                  <input
                    id="capacite"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={9999}
                    placeholder="Sans limite"
                    className="champ chiffre"
                    value={capacite ?? ''}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value));
                      setCapacite(e.target.value === '' || !(v >= 1) ? null : Math.min(9999, v));
                      reinitialiserResultat();
                    }}
                  />
                </div>
              </div>
              <p className="chiffre aide mt-2">
                {totalColis} colis à livrer{capacite ? `, ${capacite} au plus par livreur` : ''}.
              </p>
              {capaciteInsuffisante && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-attention-50 px-3 py-2.5 text-sm text-attention">
                  <p className="flex-1">
                    {livreursPossibles
                      ? `Il faut au moins ${livreursNecessaires} livreurs pour ${totalColis} colis.`
                      : `Trop de colis pour ${Math.min(NOMBRE_MAX_LIVREURS, destinations.length)} livreurs : augmentez la capacité.`}
                  </p>
                  {livreursPossibles && (
                    <button type="button" onClick={() => { setNbLivreurs(livreursNecessaires); reinitialiserResultat(); }} className="btn-encre px-3 py-1.5 text-sm">
                      Passer à {livreursNecessaires} livreurs
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Nombre de livreurs (VRP) */}
            <section className={SECTION}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold" id="label-livreurs">Livreurs</h2>
                  <p className="aide mt-0.5">
                    {nbLivreurs > 1
                      ? 'Les adresses sont réparties entre eux. Chacun revient au départ.'
                      : 'Répartissez les livraisons entre plusieurs livreurs.'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center rounded-md border border-ligne" role="group" aria-labelledby="label-livreurs">
                  <button
                    type="button"
                    onClick={() => { setNbLivreurs((k) => Math.max(1, k - 1)); reinitialiserResultat(); }}
                    disabled={nbLivreurs <= 1}
                    className="flex h-10 w-10 items-center justify-center text-encre hover:bg-sol disabled:opacity-30"
                    aria-label="Un livreur de moins"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="chiffre w-9 text-center font-titre text-xl font-bold" aria-live="polite">
                    {nbLivreurs}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setNbLivreurs((k) => Math.min(NOMBRE_MAX_LIVREURS, k + 1)); reinitialiserResultat(); }}
                    disabled={nbLivreurs >= NOMBRE_MAX_LIVREURS}
                    className="flex h-10 w-10 items-center justify-center text-encre hover:bg-sol disabled:opacity-30"
                    aria-label="Un livreur de plus"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {nbLivreurs > 1 && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 rounded-md bg-sol p-1 text-sm" role="group" aria-label="Critère de répartition">
                    {(
                      [
                        ['equilibre', 'Charges équilibrées'],
                        ['arrets', 'Même nombre d’arrêts'],
                      ] as const
                    ).map(([c, libelle]) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={critere === c}
                        onClick={() => { setCritere(c); reinitialiserResultat(); }}
                        className={`rounded px-2 py-2 font-semibold transition-colors ${
                          critere === c ? 'bg-encre text-white' : 'text-encre/60 hover:text-encre'
                        }`}
                      >
                        {libelle}
                      </button>
                    ))}
                  </div>
                  <p className="aide mt-2">
                    {critere === 'equilibre'
                      ? `Équilibre le temps de travail (route + ${minutesParLivraison} min par livraison) : celui qui va loin a moins d’arrêts.`
                      : 'Chaque livreur reçoit le même nombre d’adresses, au plus court.'}
                  </p>
                </div>
              )}
              {nbLivreurs > 1 && destinations.length > 0 && destinations.length < nbLivreurs && (
                <p className="mt-2 text-sm text-attention">
                  {destinations.length} livraison{destinations.length > 1 ? 's' : ''} seulement : {destinations.length} livreur{destinations.length > 1 ? 's' : ''} seront utilisés.
                </p>
              )}
            </section>

            {/* Action principale, toujours visible */}
            <div className="sticky bottom-[68px] z-10 mt-auto border-t border-ligne bg-white px-5 py-4 md:bottom-0">
              <button onClick={optimiser} disabled={!peutOptimiser || chargement} className="btn-primaire w-full py-3.5 text-base">
                {chargement ? <Spinner /> : <Wand2 className="h-5 w-5" />}
                {chargement ? 'Optimisation en cours…' : 'Optimiser la tournée'}
              </button>
              {!peutOptimiser && (
                <p className="aide mt-2 text-center">Ajoutez un départ et au moins une livraison.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-6">
              <div>
                <h1 className="font-titre text-2xl font-bold tracking-tight">Tournée optimisée</h1>
                <p className="mt-1 text-encre/60">
                  {resultat.source === 'osrm' ? 'Calculée sur les routes réelles.' : 'Estimée à vol d’oiseau.'}
                </p>
              </div>
              <button onClick={reinitialiserResultat} className="btn-secondaire shrink-0 px-3 py-2 text-sm">
                <Pencil className="h-4 w-4" /> Modifier
              </button>
            </div>
            {resultat.livreurs && resultat.livreurs.length > 1 ? (
              <>
                <ResultCard resultat={resultat} boucle={!arriveeDistincte} />
                <LivreursPanel
                  resultat={resultat}
                  nom={nomTournee}
                  livreurActif={livreurActif}
                  onSelectionner={setLivreurActif}
                />
              </>
            ) : (
              <ResultCard
                resultat={resultat}
                boucle={!arriveeDistincte}
                actions={<ExportActions resultat={resultat} boucle={!arriveeDistincte} nom={nomTournee} />}
              />
            )}
            <section className={SECTION}>
              <label htmlFor="nom-tournee" className="mb-2 block font-titre text-lg font-semibold">
                Enregistrer dans l’historique
              </label>
              <div className="flex gap-2">
                <input
                  id="nom-tournee"
                  className="champ"
                  placeholder="Ex. : Livraisons du matin"
                  value={nomTournee}
                  onChange={(e) => setNomTournee(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sauvegarder()}
                  maxLength={120}
                />
                <button onClick={sauvegarder} disabled={sauvegarde} className="btn-encre shrink-0" aria-label="Enregistrer la tournée">
                  {sauvegarde ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  <span className="hidden sm:inline">Enregistrer</span>
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
