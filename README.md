# RouteBénin 🚚

**Optimisez vos livraisons. Gagnez du temps. Réduisez vos distances.**

> 🌍 **Démo en ligne : https://adkfull-dev.github.io/routebenin/**
> (version navigateur : l'optimisation tourne côté client, l'historique est
> enregistré dans votre navigateur. La version full-stack ci-dessous ajoute une
> base de données partagée.)

RouteBénin est une application web qui calcule l'**ordre de passage optimal**
d'une tournée de livraison (problème du voyageur de commerce) et l'affiche sur
une carte interactive, avec le **gain obtenu** (« Avant 42 km → Après 29 km, −31 % »).

Marché initial : Cotonou, Abomey-Calavi, Porto-Novo (Bénin). Architecture prête
pour d'autres villes et pays.

---

## ✨ Fonctionnalités

- **Tableau de bord** : nombre de tournées, distance parcourue, distance économisée, taux moyen d'optimisation, dernières tournées.
- **Optimisation de tournée** : départ, destinations (ajout par recherche d'adresse ou clic sur la carte, réordonnables par glisser-déposer), arrivée optionnelle.
- **Carte interactive** (OpenStreetMap / Leaflet) : marqueurs numérotés, tracé routier réel, départ et arrivée distincts.
- **Résultat clair** : distance avant/après, gain en km et en %, durée estimée, ordre de passage.
- **Historique** : consultation et suppression des tournées enregistrées.
- **Comparaison avant/après** : tracé de l'ordre de saisie (rouge pointillé) et tracé optimisé (bleu) superposés, avec animation de l'itinéraire.
- **Multi-livreurs (1 à 6)** : répartition équilibrée des adresses entre plusieurs livreurs partant du même point, une couleur par livreur.
- **Envoi au livreur** : message WhatsApp prêt à partager, copie du texte, feuille de route imprimable/PDF (cases « Livré », observations, signature) et liens de navigation Google Maps.
- **Paramètres** : profil utilisateur/entreprise, préférence distances routières, serveur OSRM personnel (mode navigateur), équipe (mode comptes).
- **Comptes et entreprises** (optionnel, `COMPTES=oui`) : plusieurs entreprises clientes isolées, administrateur et membres, et page de présentation publique (voir « Version multi-entreprises »).
- **Tout le Bénin** : recherche hors ligne et tolérante aux fautes dans un répertoire national (12 départements, 77 communes, ~12 500 villes, villages, hameaux et quartiers OpenStreetMap, régénérable avec `npm run lieux-benin` dans `server/`), en plus des quartiers du Grand Cotonou et de Nominatim. La carte s'ouvre sur la ville du profil ; un exemple interurbain (Zou et Collines, au départ de Bohicon) complète celui de Cotonou. Sans service routier, les durées sont estimées à 25 km/h en ville et jusqu'à 65 km/h entre villes.
- **Mode livreur** : le message WhatsApp contient un lien qui ouvre la tournée sur le téléphone du livreur, sans compte ni installation (la tournée voyage compressée dans le lien, ~600 caractères pour 14 arrêts). Prochain arrêt en grand (« Y aller » dans Google Maps, « Appeler » le client), boutons **Livré** / **Absent** avec motif, arrêts restants réordonnables, **ré-optimisation du reste depuis la position GPS** (heures de passage recalculées), annulation, et **compte-rendu** renvoyé au responsable sur WhatsApp. L'avancement est enregistré sur le téléphone et fonctionne hors ligne.
- **Contact client** : téléphone et indication (« portail bleu après la pharmacie ») par livraison, repris dans le message, le PDF et le mode livreur.
- **Créneaux horaires et capacité** : créneau et nombre de colis par livraison (bouton réglages de l'arrêt), heure de départ, colis par livreur. Le résultat donne l'heure de passage prévue à chaque arrêt, l'attente éventuelle, les retards, le chargement de chaque livreur, et propose d'ajouter des livreurs si la capacité ne suffit pas.
- **Mode hors-ligne (PWA)** : installable sur l'écran d'accueil du téléphone ; l'application, l'exemple de démo, les zones de carte déjà consultées et les derniers itinéraires calculés restent disponibles sans réseau (voir plus bas).
- **Responsive** (ordinateur, tablette, mobile) : sur téléphone, la carte passe en haut et le bouton « Optimiser » reste toujours visible.
- **Identité visuelle** : encre indigo + jaune des chemises de zémidjans, police Barlow (inspirée de la signalisation routière), carte désaturée pour que le trajet ressorte, et la tournée dessinée comme un itinéraire (mêmes pastilles numérotées dans la liste et sur la carte).

---

## 🧠 Le moteur d'optimisation

Code entièrement maison (aucune bibliothèque d'optimisation externe), dans
`server/src/algorithms/` — module **pur**, sans réseau, testé :

1. **Modélisation en graphe** : chaque point est un nœud, les arêtes portent la distance.
2. **Matrice de distances** : distances routières réelles via **OSRM**, sinon repli **Haversine** (à vol d'oiseau).
3. **Plus Proche Voisin** : construction gloutonne d'une première tournée.
4. **2-opt** : amélioration locale par décroisement des segments, jusqu'à stabilité
   (gain exact y compris pour les distances routières asymétriques — sens uniques).
5. **Or-opt** : déplacement d'un point à une meilleure position, alterné avec 2-opt.
6. **Comparaison** avant/après pour mesurer le gain réel.
7. **Multi-livreurs (VRP)** — `vrp.ts` : balayage angulaire autour du dépôt
   (tous les points de départ essayés), TSP par secteur, puis échanges et
   déplacements entre tournées. Deux critères :
   - **charges équilibrées** (défaut) : charge = temps de conduite (durées OSRM)
     + 5 min par livraison ; on minimise Σ charge² = K·(moyenne² + variance).
     Sans durées (repli vol d'oiseau) : distance + 2 km par arrêt.
     Exemple de Cotonou, 3 livreurs : 73 / 74 / 72 min de travail (écart 2 min)
     contre 79 / 54 / 90 min avec « même nombre d'arrêts » ;
   - **même nombre d'arrêts** : distance totale minimale, ⌈n / K⌉ arrêts max.
8. **Créneaux horaires et capacité (VRPTW capacitaire)** — `contraintes.ts` :
   chaque livraison peut avoir un créneau (« entre 10:00 et 12:00 », ou seulement
   avant / après) et un nombre de colis ; chaque livreur une capacité en colis.
   - *Simulation* : on roule (durées OSRM, sinon 25 km/h), on **attend** si l'on
     arrive avant l'ouverture, on compte le **retard** si l'on arrive après la
     fermeture, puis on passe le temps de livraison sur place.
   - *Objectif lexicographique* : 1) colis au-delà de la capacité, 2) minutes de
     retard, 3) plafond d'arrêts (critère « même nombre »), 4) distance ou
     équilibre. Une tournée à l'heure bat toujours une tournée plus courte en retard.
   - *Une tournée* : trois solutions initiales (plus courte, tri par heure limite,
     tri par heure d'ouverture), puis recherche locale Or-opt (segments de 1 à 3
     arrêts), 2-opt et échanges.
   - *Plusieurs livreurs* : la répartition classique sert de départ, puis
     déplacements (meilleure insertion) et échanges entre livreurs, puis
     réordonnancement de chaque tournée.
   - Sans créneau ni capacité, le moteur reste celui des points 1 à 7.

Le TSP étant NP-difficile, cette approche offre un excellent compromis
qualité/vitesse (optimum exact vérifié par force brute sur les petits cas dans les tests).

**Mesures** : `npm run bench` régénère [`docs/benchmarks/BENCHMARKS.md`](docs/benchmarks/BENCHMARKS.md)
(écart à l'optimum, temps de calcul selon N, gain vs ordre de saisie) avec les
figures SVG/PNG prêtes pour le mémoire.

---

## 🏗️ Architecture

```
routebenin/
├── client/                 Frontend React + Vite + TypeScript + Tailwind + Leaflet
│   └── src/
│       ├── components/      MapView, AddressSearch, StopList, ResultCard, ui, Toast
│       ├── pages/           Dashboard, Optimize, History, Settings
│       ├── lib/             api.ts, format.ts, demoCotonou.ts
│       └── types/
├── server/                 Backend Node.js + Express + TypeScript
│   ├── src/
│   │   ├── algorithms/      tsp.ts, distance.ts  (purs + tests)
│   │   ├── services/        nominatim.ts, osrm.ts, cache.ts, optimisation.ts
│   │   ├── controllers/     geocode, optimize, tournees, profil
│   │   ├── routes/          agrégateur /api
│   │   └── lib/             env, prisma, validation, http
│   └── prisma/              schema.prisma (SQLite)
├── package.json            scripts racine (npm run dev lance client + serveur)
└── README.md
```

**Choix techniques notables**
- **SQLite + Prisma** (plutôt que PostgreSQL) : aucun serveur de base à installer, application immédiatement fonctionnelle. Passage à PostgreSQL = changer `provider` + `DATABASE_URL`.
- **OSRM isolé dans un service** avec repli Haversine automatique : l'application fonctionne même si le service d'itinéraire est indisponible (l'utilisateur est averti).
- **Nominatim** : 1 requête/seconde, User-Agent dédié, résultats mis en cache (respect de la politique d'usage).
- Application **mono-utilisateur** (pas d'authentification en v1) ; le modèle `Profil` et l'architecture permettent d'ajouter des comptes ultérieurement.

---

## 🚀 Installation et lancement (Ubuntu)

### Prérequis
- **Node.js 20+** et **npm**.
  Vérifier : `node -v && npm -v`.
  Installation possible via [nvm](https://github.com/nvm-sh/nvm) ou `sudo apt install nodejs npm`.

### 1. Installer les dépendances
```bash
cd routebenin
npm run install:all
```

### 2. Configurer l'environnement
```bash
cp server/.env.example server/.env
# (valeurs par défaut fonctionnelles ; adaptez OSRM_URL / NOMINATIM_USER_AGENT au besoin)
```

### 3. Préparer la base de données (SQLite)
```bash
npm run db:setup      # génère le client Prisma + crée la base
```

### 4. Lancer en développement (client + serveur)
```bash
npm run dev
```
- Frontend : http://localhost:5173
- API : http://localhost:3001

### Autres commandes
```bash
npm test              # tests du moteur d'optimisation (Vitest)
npm run bench         # benchmarks → docs/benchmarks/
npm run build         # build de production (serveur + client)
```

---

## 🗺️ Services géographiques

Par défaut, l'application utilise les serveurs **publics** d'OpenStreetMap
(Nominatim) et le serveur de démonstration **OSRM** (`router.project-osrm.org`).
Ces serveurs publics conviennent au développement et à une démonstration, mais
sont **limités en débit**.

Pour un usage réel, **hébergez votre propre OSRM pour tout le Bénin**, sans
Docker (binaires précompilés, ~200 Mo de RAM en marche, préparation en ~1 min) :

```bash
npm run osrm:preparer   # télécharge et prépare la carte du Bénin
npm run osrm:lancer     # http://localhost:5000
# full-stack : OSRM_URL=http://localhost:5000 dans server/.env
# navigateur : Paramètres → « Serveur d'itinéraires »
```

Sur un VPS, `sudo deploy/osrm/osrm.sh installer-serveur osrm.mon-domaine.bj`
installe le service, le https (Caddy) et la mise à jour hebdomadaire de la carte.
Détails : [`deploy/osrm/README.md`](deploy/osrm/README.md). Le serveur public
reste utilisé en secours si le vôtre ne répond pas.

Aucune clé secrète n'est requise ni exposée côté frontend.

---

## 🔎 Recherche d'adresses

Trois sources fusionnées, les deux premières hors ligne :

1. **quartiers et repères du Grand Cotonou** (`client/src/lib/quartiers.ts`) :
   ~60 entrées dont les coordonnées sont relevées dans OpenStreetMap
   (carrefours Saint-Michel, Védoko/Cica Toyota, Kpota, PK3, PK10, UAC, IITA,
   Stade de l'Amitié…), avec alias (« UAC », « Tokpa », « Calavi ») ;
2. **répertoire national** (~12 500 lieux OSM, voir plus haut) ;
3. **Nominatim** en ligne (adresses précises, commerces).

La recherche accepte la façon dont on donne une adresse au Bénin :
**plusieurs mots dans n'importe quel ordre** (« Godomey Togoudo », « Porto-Novo
Ouando », « Parakou Banikanni »), **mots génériques ignorés** (« carrefour
Vèdoko », « pharmacie de Cadjèhoun », « marché Ganhi »), **abréviations**
(« St Michel », « Ste Rita »), accents manquants et fautes de frappe. Nominatim
échouant souvent avec « carrefour … », il est relancé sans ces mots.

---

## 🧪 Démonstration

Sur la page **Nouvelle tournée**, le bouton **« Charger un exemple »** insère
14 quartiers de Cotonou et des environs (Dantokpa, Aéroport, Fidjrossè,
Akpakpa, Cadjèhoun, Ganhi, Haie Vive, Abomey-Calavi, Porto-Novo…). Les
coordonnées viennent d'OpenStreetMap ; la **tournée est fictive**, mais les
distances et le gain calculés sont **réels** (157,7 → 131,6 km, −16,5 %).

### Démo fiable sans dépendre du serveur OSRM public

Pour ces 15 points, l'application embarque un **pack démo**
(`client/src/data/packDemo.json`, chargé à la demande) : la matrice OSRM
complète (distances et durées) et la géométrie routière des 210 trajets
point → point, dans les deux sens. N'importe quel ordre de passage, en tournée
unique ou multi-livreurs, est rejoué à partir de ces tronçons, **sans requête
vers OSRM** : la démo reste instantanée même si le serveur public est saturé
ou si le réseau de la salle est faible. Les données sont de vraies données OSRM.

```bash
npm --prefix server run pack-demo   # régénère le pack (~4 min, 1 requête/s)
OSRM_URL=http://localhost:5000 npm --prefix server run pack-demo   # avec votre OSRM (deploy/osrm)
```

Limites : le fond de carte (tuiles OpenStreetMap) et la recherche d'adresses
nécessitent toujours internet ; toute adresse ajoutée hors de l'exemple passe
par OSRM normalement. Pour une indépendance totale, hébergez OSRM (section
« Services géographiques »).

---

## 📶 Mode hors-ligne (PWA)

Au Bénin le réseau mobile est souvent faible : RouteBénin est une **Progressive
Web App**. Au premier passage en ligne, un *service worker* (`client/pwa/sw.js`,
injecté au build par le plugin de `client/vite.config.ts`) met en cache toute
l'application. Ensuite :

| Ressource | Stratégie | Hors ligne |
|---|---|---|
| Application (HTML, JS, CSS, icônes, pack démo) | pré-cachée à l'installation | ✅ s'ouvre et optimise |
| Tuiles de carte OSM | cache d'abord, zones **déjà vues** uniquement (max 2 000) | ✅ zones consultées |
| OSRM (distances, tracés) | réseau d'abord, sinon dernière réponse connue | ✅ si déjà calculé, sinon vol d'oiseau |
| Nominatim (adresses) | réseau d'abord, sinon cache | quartiers locaux toujours dispo |
| Historique, profil | `localStorage` | ✅ |

- Bandeau « Hors ligne » automatique, bouton **Installer** (Android/Chrome),
  instructions « Sur l'écran d'accueil » sur iPhone.
- Nouvelle version déployée → bandeau **« Mettre à jour »** (pas de rechargement
  forcé en pleine saisie).
- Paramètres → *Application et hors-ligne* : état, espace utilisé, vider le cache.
- Pas de pré-téléchargement massif des tuiles : interdit par la politique
  d'usage d'OpenStreetMap.

---

## 🏢 Version multi-entreprises (comptes)

Le serveur peut accueillir **plusieurs entreprises clientes**, chacune avec son
équipe. Activez-le dans `server/.env` :

```bash
COMPTES=oui            # connexion obligatoire
INSCRIPTIONS=ouvertes  # « fermees » : pas de création de compte libre
COOKIE_SECURISE=oui    # derrière un proxy https
```

- **Créer un compte entreprise** depuis la page de connexion : la personne en
  devient l'**administrateur**. Au passage du mode mono-utilisateur aux comptes,
  la première entreprise créée récupère l'historique et les réglages existants.
- **Équipe** (Paramètres) : l'administrateur ajoute des membres (nom, e-mail,
  mot de passe à leur transmettre, rôle) ou les retire ; chacun peut changer son
  mot de passe (les autres appareils sont alors déconnectés).
- **Isolation** : tournées, statistiques et réglages sont filtrés sur
  l'entreprise de la personne connectée ; une tournée d'une autre entreprise
  répond « introuvable ». Seul l'administrateur modifie les réglages communs
  (temps par livraison, ville, routes réelles).
- **Sécurité** : mots de passe hachés avec scrypt (sel aléatoire, comparaison
  en temps constant), session dans un cookie `HttpOnly; SameSite=Lax` dont la
  base ne garde que l'empreinte SHA-256, 30 jours ; 10 essais de connexion
  ratés par quart d'heure au plus (IP + e-mail).
- Tests : `server/src/comptes.test.ts` (inscription, isolation, rôles,
  tentatives, mot de passe) sur une base SQLite jetable.

Sans `COMPTES=oui`, rien ne change (application mono-utilisateur), et la démo
GitHub Pages, 100 % navigateur, reste sans compte.

**Page de présentation** (`#/presentation`, publique) : à montrer à une
entreprise de livraison (problème, fonctions, chiffres de l'exemple, « essayer
l'exemple »). Boutons de contact facultatifs, fixés à la compilation :
`VITE_CONTACT_WHATSAPP=229XXXXXXXX` et `VITE_CONTACT_EMAIL=…`.

---

## 🌐 Déploiement (GitHub Pages)

La démo en ligne est une **version 100 % navigateur** (sans backend) : le moteur
d'optimisation tourne côté client, OSRM/Nominatim sont appelés directement, et
l'historique utilise `localStorage`. Pour la régénérer et la publier :

```bash
cd client
npm run build:pages          # build en mode statique (base /routebenin/)
cd dist && touch .nojekyll
git init -q && git checkout -b gh-pages && git add -A
git commit -m "Déploiement"
git push -f https://github.com/ADKfull-dev/routebenin.git gh-pages
```

Pour la version **complète** (comptes, entreprises, OSRM du Bénin, https,
sauvegardes) sur un VPS Ubuntu : `sudo deploy/serveur/installer.sh installer
<domaine|auto> <email>` — voir [`deploy/serveur/README.md`](deploy/serveur/README.md).
En production, l'API sert aussi l'interface (`npm --prefix client run
build:serveur`, `CLIENT_DIST=…`), sur la même origine que le cookie de session.

## 📝 Licence et données

Données cartographiques © OpenStreetMap (ODbL). Itinéraires via OSRM.
Projet réalisé par Wafik ADOUKO.
