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
- **Paramètres** : profil utilisateur/entreprise, préférence distances routières.
- **Responsive** (ordinateur, tablette, mobile) + **mode sombre** automatique.

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
     Exemple de Cotonou, 3 livreurs : 73 / 69 / 74 min de travail (écart 5 min)
     contre 73 / 48 / 96 min avec « même nombre d'arrêts » ;
   - **même nombre d'arrêts** : distance totale minimale, ⌈n / K⌉ arrêts max.

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

Pour un usage réel/production, **hébergez votre propre instance OSRM** avec la
carte du Bénin (via Docker) et renseignez son URL dans `server/.env` :

```bash
# Exemple (nécessite Docker) — carte : https://download.geofabrik.de/africa/benin.html
wget https://download.geofabrik.de/africa/benin-latest.osm.pbf
docker run -t -v "$(pwd):/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/benin-latest.osm.pbf
docker run -t -v "$(pwd):/data" osrm/osrm-backend osrm-partition /data/benin-latest.osrm
docker run -t -v "$(pwd):/data" osrm/osrm-backend osrm-customize /data/benin-latest.osrm
docker run -t -i -p 5000:5000 -v "$(pwd):/data" osrm/osrm-backend osrm-routed --algorithm mld /data/benin-latest.osrm
# puis dans server/.env : OSRM_URL=http://localhost:5000
```

Aucune clé secrète n'est requise ni exposée côté frontend.

---

## 🧪 Démonstration

Sur la page **Nouvelle tournée**, le bouton **« Charger un exemple »** insère
14 adresses réelles de Cotonou et des environs (Dantokpa, Aéroport, Fidjrossè,
Akpakpa, Cadjèhoun, Ganhi, Haie Vive, Abomey-Calavi, Porto-Novo…). Les
coordonnées sont réelles ; la **tournée est fictive**, mais les distances et le
gain calculés sont **réels**.

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
```

Limites : le fond de carte (tuiles OpenStreetMap) et la recherche d'adresses
nécessitent toujours internet ; toute adresse ajoutée hors de l'exemple passe
par OSRM normalement. Pour une indépendance totale, hébergez OSRM (Docker,
section « Services géographiques »).

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

Pour un déploiement **full-stack** (avec base de données partagée), hébergez le
dossier `server/` sur un service Node (Render, Railway, Fly.io…) et le `client/`
(build normal) sur un hébergeur statique, en pointant le proxy `/api` vers l'API.

## 📝 Licence et données

Données cartographiques © OpenStreetMap (ODbL). Itinéraires via OSRM.
Projet réalisé par Wafik ADOUKO.
