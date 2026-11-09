/**
 * Presentation — page publique qui explique RouteBénin à une entreprise de
 * livraison : le problème, ce que fait l'outil, les chiffres de l'exemple, et
 * comment l'essayer. Coordonnées de contact facultatives, fixées à la
 * compilation (VITE_CONTACT_WHATSAPP, VITE_CONTACT_EMAIL).
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  MapPinned,
  MessageCircle,
  Smartphone,
  Users,
  WifiOff,
  Mail,
  Route as IconeRoute,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Marque } from '../App';
import { useSession } from '../lib/session';

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP as string | undefined)?.replace(/[^\d]/g, '') || null;
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;

const atouts: { icone: LucideIcon; titre: string; texte: string }[] = [
  {
    icone: IconeRoute,
    titre: 'Le meilleur ordre de passage',
    texte: 'Vous saisissez les adresses dans n’importe quel ordre ; RouteBénin calcule la tournée la plus courte sur les vraies routes.',
  },
  {
    icone: Users,
    titre: 'Plusieurs livreurs',
    texte: 'Jusqu’à 6 livreurs partant du même dépôt, avec des journées équilibrées : personne ne finit à 15 h pendant qu’un autre rentre à 19 h.',
  },
  {
    icone: Clock,
    titre: 'Créneaux et chargement',
    texte: '« Entre 10 h et 12 h », nombre de colis, capacité de la moto : l’heure de passage prévue est donnée pour chaque client.',
  },
  {
    icone: Smartphone,
    titre: 'Le livreur suit sa tournée',
    texte: 'Un lien WhatsApp ouvre la tournée sur son téléphone : navigation, appel du client, livré / absent, et compte-rendu renvoyé.',
  },
  {
    icone: MapPinned,
    titre: 'Les adresses d’ici',
    texte: 'Quartiers, carrefours et repères (« carrefour Védoko », « Godomey Togoudo »), et plus de 12 000 lieux dans les 77 communes.',
  },
  {
    icone: WifiOff,
    titre: 'Même avec un réseau faible',
    texte: 'Application installable sur le téléphone, qui continue de fonctionner hors connexion pour ce qui a déjà été chargé.',
  },
];

const etapes = [
  ['Saisissez les livraisons', 'Recherche d’adresse, clic sur la carte, téléphone et indication pour chaque client.'],
  ['Optimisez', 'Un bouton : ordre de passage, distance, durée, heures prévues, répartition entre livreurs.'],
  ['Envoyez au livreur', 'Par WhatsApp. Il coche chaque arrêt ; vous recevez son compte-rendu.'],
];

export function Presentation() {
  const { etat } = useSession();
  const avecComptes = !!etat?.comptes;
  const contact = WHATSAPP || EMAIL;

  return (
    <div className="min-h-full bg-sol">
      {/* En-tête + accroche */}
      <header className="bg-encre text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <Marque className="h-9 w-9" />
            <span className="font-titre text-xl font-semibold">RouteBénin</span>
          </Link>
          <Link to={avecComptes && !etat?.utilisateur ? '/connexion' : '/'} className="text-sm font-semibold text-white/80 hover:text-white">
            {avecComptes && !etat?.utilisateur ? 'Se connecter' : 'Ouvrir l’application'}
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-8 md:px-8 md:pb-20 md:pt-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-zem">Tournées de livraison au Bénin</p>
          <h1 className="mt-3 max-w-3xl font-titre text-[2.25rem] font-bold leading-[1.05] tracking-tight md:text-[3.25rem]">
            Moins de kilomètres, des clients livrés à l’heure.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            RouteBénin calcule l’ordre de passage de vos livreurs sur les vraies routes de Cotonou et de tout le pays,
            puis leur envoie la tournée sur WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/optimiser?exemple=1" className="btn-primaire px-5 py-3 text-base">
              Essayer avec un exemple <ArrowRight className="h-5 w-5" />
            </Link>
            {avecComptes && etat?.inscriptionsOuvertes && !etat.utilisateur && (
              <Link to="/connexion" className="btn border border-white/25 px-5 py-3 text-base text-white hover:bg-white/10">
                Créer le compte de mon entreprise
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Chiffres de l'exemple */}
      <section className="mx-auto -mt-8 max-w-5xl px-4 md:px-8">
        <div className="feuille grid grid-cols-1 divide-y divide-ligne sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ['−16,5 %', 'de distance sur l’exemple de Cotonou', '14 livraisons : 157,7 → 131,6 km'],
            ['26 km', 'économisés sur une seule tournée', 'carburant et temps de moto en moins'],
            ['2 min', 'd’écart entre 3 livreurs', 'journées de 72 à 74 min, au lieu de 54 à 90'],
          ].map(([chiffre, libelle, detail]) => (
            <div key={chiffre} className="px-5 py-5">
              <p className="chiffre font-titre text-3xl font-bold">{chiffre}</p>
              <p className="mt-1 font-medium">{libelle}</p>
              <p className="chiffre mt-0.5 text-sm text-encre/55">{detail}</p>
            </div>
          ))}
        </div>
        <p className="aide mt-2 px-1">Distances routières réelles (OSRM, carte OpenStreetMap) ; tournée d’exemple fictive.</p>
      </section>

      {/* Atouts */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <h2 className="font-titre text-2xl font-bold tracking-tight">Ce que fait RouteBénin</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atouts.map(({ icone: Icone, titre, texte }) => (
            <div key={titre} className="feuille p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-zem">
                <Icone className="h-5 w-5 text-encre" strokeWidth={2} />
              </span>
              <h3 className="mt-3 text-lg font-semibold">{titre}</h3>
              <p className="mt-1 text-encre/65">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-y border-ligne bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
          <h2 className="font-titre text-2xl font-bold tracking-tight">En trois gestes</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {etapes.map(([titre, texte], i) => (
              <li key={titre} className="flex gap-4">
                <span className="chiffre flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-encre bg-zem font-titre text-lg font-bold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{titre}</h3>
                  <p className="mt-1 text-encre/65">{texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Appel final */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <div className="rounded-xl bg-encre p-6 text-white md:p-10">
          <h2 className="font-titre text-2xl font-bold">Voyez sur vos propres adresses</h2>
          <p className="mt-2 max-w-xl text-white/75">
            L’exemple se charge en un clic. Remplacez ensuite les adresses par celles de vos clients de demain.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/optimiser?exemple=1" className="btn-primaire px-5 py-3">
              Lancer l’exemple <ArrowRight className="h-5 w-5" />
            </Link>
            {WHATSAPP && (
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Bonjour, je souhaite en savoir plus sur RouteBénin pour mes livraisons.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp px-5 py-3"
              >
                <MessageCircle className="h-5 w-5" /> Nous écrire sur WhatsApp
              </a>
            )}
            {EMAIL && (
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('RouteBénin')}`} className="btn border border-white/25 px-5 py-3 text-white hover:bg-white/10">
                <Mail className="h-5 w-5" /> {EMAIL}
              </a>
            )}
          </div>
          {!contact && <p className="mt-4 text-sm text-white/50">Aucune inscription requise pour essayer.</p>}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-encre/50 md:px-8">
        Données cartographiques © contributeurs OpenStreetMap.
      </footer>
    </div>
  );
}
