# RouteBénin 🚚

**Optimisez vos livraisons. Gagnez du temps. Réduisez vos distances.**

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
- **Paramètres** : profil utilisateur/entreprise, préférence distances routières.
- **Responsive** (ordinateur, tablette, mobile) + **mode sombre** automatique.

---

## 🧠 Le moteur d'optimisation

Code entièrement maison (aucune bibliothèque d'optimisation externe), dans
`server/src/algorithms/` — module **pur**, sans réseau, testé :

1. **Modélisation en graphe** : chaque point est un nœud, les arêtes portent la distance.
2. **Matrice de distances** : distances routières réelles via **OSRM**, sinon repli **Haversine** (à vol d'oiseau).
3. **Plus Proche Voisin** : construction gloutonne d'une première tournée.
4. **2-opt** : amélioration locale par décroisement des segments, jusqu'à stabilité.
5. **Comparaison** avant/après pour mesurer le gain réel.

Le TSP étant NP-difficile, cette approche offre un excellent compromis
qualité/vitesse (optimum exact vérifié par force brute sur les petits cas dans les tests).

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

---

## 📝 Licence et données

Données cartographiques © OpenStreetMap (ODbL). Itinéraires via OSRM.
Projet réalisé par Wafik ADOUKO.
