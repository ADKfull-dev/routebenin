# RouteBénin — Optimiseur de tournées de livraison

> Cahier des charges — projet de Wafik ADOUKO
> Application web qui calcule l'ordre de passage optimal d'une tournée de livraison
> (problème du voyageur de commerce / VRP) et l'affiche sur une carte.

---

## 1. Vision & objectif

**Problème.** À Cotonou / Porto-Novo, les livreurs (e-commerce, restaurants, pharmacies,
coursiers moto-taxi « zem ») organisent leurs tournées de tête. Résultat : trajets en
zigzag, carburant et temps perdus, clients livrés en retard.

**Solution.** Le livreur saisit ses adresses du jour → RouteBénin calcule **le meilleur
ordre de passage** et trace l'itinéraire sur une carte. Objectif mesurable : **réduire la
distance totale de 20 à 30 %**.

**Pourquoi c'est un bon projet.** Il réunit :
- de la **vraie algorithmique** (graphes, plus court chemin, optimisation combinatoire) — ce qui te démarque en soutenance ;
- du **full-stack** (ton point fort) ;
- un **rendu visuel fort** (carte + itinéraire) qui marque le jury ;
- un **besoin économique local réel**.

---

## 2. Utilisateurs & cas d'usage

| Utilisateur | Besoin |
|---|---|
| Livreur indépendant / zem | Optimiser une tournée de 5–20 points depuis sa position |
| Petit commerce (restaurant, boutique) | Planifier les livraisons du jour |
| (Avancé) Gérant avec plusieurs livreurs | Répartir N points entre M livreurs |

**Parcours principal (MVP) :**
1. Le livreur ouvre l'appli, voit la carte.
2. Il ajoute ses adresses (recherche par nom OU clic sur la carte).
3. Il définit son point de départ (sa position).
4. Il clique « Optimiser ».
5. L'appli affiche l'ordre numéroté + l'itinéraire tracé + la distance/temps total gagné.
6. Il peut suivre la tournée (point par point) et sauvegarder.

---

## 3. Fonctionnalités

### MVP (à livrer en priorité — c'est ça qu'on présente)
- [ ] Carte interactive (OpenStreetMap, gratuit).
- [ ] Ajouter des points : recherche d'adresse (géocodage) + clic sur carte.
- [ ] Définir le point de départ (et optionnellement d'arrivée).
- [ ] **Calcul de l'ordre optimal** (le cœur algorithmique).
- [ ] Affichage de l'itinéraire réel sur route + ordre numéroté.
- [ ] Indicateur « distance avant / après optimisation » (le « waouh »).
- [ ] Sauvegarder / recharger une tournée.

### Fonctionnalités avancées (bonus, selon le temps)
- [ ] **Multi-livreurs** (VRP) : répartir les points entre plusieurs tournées.
- [ ] Contraintes : fenêtres horaires, capacité du véhicule.
- [x] Mode hors-ligne léger (PWA) pour les zones à faible réseau.
- [ ] Export de la feuille de route (PDF / partage WhatsApp).
- [ ] Comparaison visuelle « tournée naïve vs optimisée » (animation).

---

## 4. Le cœur algorithmique (la partie qui compte en soutenance)

### 4.1 Modélisation en graphe
- Chaque point de livraison = **un nœud**.
- Entre deux nœuds i et j : une **arête** pondérée par la **distance (ou le temps) de
  route réelle** d(i,j).
- On obtient une **matrice de distances** N×N.
- Trouver la meilleure tournée = trouver le **cycle hamiltonien de poids minimal**
  → c'est le **problème du voyageur de commerce (TSP)**.

### 4.2 Obtenir les distances réelles (pas à vol d'oiseau)
Deux options, à expliquer dans le mémoire :
- **Distance à vol d'oiseau (Haversine)** : simple, instantané, mais imprécis en ville.
- **Distance routière réelle** via **OSRM** (Open Source Routing Machine), qui renvoie
  directement une *matrice temps/distance* (`/table`) et les tracés (`/route`).
  → C'est ça qui donne un itinéraire crédible sur la carte.

> Astuce mémoire : montre que tu as comparé les deux et choisi OSRM pour le réalisme.
> OSRM s'appuie en interne sur **Dijkstra / Contraction Hierarchies** — tu peux le relier
> à ton cours de graphes (plus court chemin).

### 4.3 Résolution du TSP — approche progressive (à présenter comme une montée en qualité)

Le TSP est **NP-difficile** : impossible de tester toutes les permutations dès ~12 points
(12! ≈ 479 millions). D'où une stratégie en 3 niveaux :

1. **Force brute** (petit N ≤ 9) — pour prouver l'optimalité sur petits cas et comparer.
2. **Heuristique de construction — Plus Proche Voisin (Nearest Neighbor)** :
   partir du départ, aller toujours au point non visité le plus proche. Rapide,
   donne une solution correcte (~25 % au-dessus de l'optimal).
3. **Amélioration locale — 2-opt** : on prend la tournée du plus proche voisin et on
   « décroise » les segments qui se croisent, tant que ça réduit la distance.
   → C'est le combo gagnant : **Plus Proche Voisin + 2-opt** donne d'excellents résultats
   et se code soi-même (ne PAS utiliser de boîte noire — le jury veut voir TON algo).

**Pseudocode 2-opt (le cœur à coder toi-même) :**
```
fonction deux_opt(tournée, D):           # D = matrice de distances
    amélioré = vrai
    tant que amélioré:
        amélioré = faux
        pour i de 1 à n-2:
            pour j de i+1 à n-1:
                # distance actuelle des 2 arêtes vs après inversion du segment [i..j]
                avant = D[t[i-1]][t[i]] + D[t[j]][t[j+1]]
                après = D[t[i-1]][t[j]] + D[t[i]][t[j+1]]
                si après < avant:
                    inverser le segment tournée[i..j]
                    amélioré = vrai
    retourner tournée
```

4. **(Bonus) Multi-livreurs = VRP** : algorithme des **économies de Clarke-Wright**, ou
   « clusteriser d'abord (k-means géographique), router ensuite (TSP par cluster) ».

### 4.4 Ce qu'on mesure (pour le mémoire)
- Distance tournée naïve (ordre de saisie) vs optimisée → **% de gain**.
- Temps de calcul selon N.
- Qualité Plus Proche Voisin seul vs + 2-opt vs optimal (sur petits N).

---

## 5. Architecture technique

```
┌─────────────────────────────┐
│  FRONTEND (navigateur)      │
│  React + Leaflet (carte)    │
│  - saisie des points        │
│  - affichage itinéraire     │
└──────────────┬──────────────┘
               │ HTTP (JSON)
┌──────────────▼──────────────┐
│  BACKEND  Node.js + Express │
│  - /geocode  (adresse→GPS)  │
│  - /matrix   (distances)    │
│  - /optimize (TSP: NN+2opt) │ ← TON code algorithmique
│  - /route    (tracé)        │
│  - /tours    (sauvegarde)   │
└──────┬───────────────┬──────┘
       │               │
┌──────▼──────┐  ┌─────▼──────────────┐
│ SQLite/     │  │ Services carto      │
│ PostgreSQL  │  │ - Nominatim (géocod)│
│ (tournées)  │  │ - OSRM (matrice+route)
└─────────────┘  └─────────────────────┘
```

**Important :** la logique TSP (NN + 2-opt) est **codée par toi** dans le backend.
OSRM/Nominatim ne servent qu'à fournir les distances réelles et les tracés — ils ne
résolvent PAS le problème d'ordonnancement à ta place. C'est ta valeur ajoutée.

---

## 6. Stack technique & ce qu'il faut installer

### Choix retenus (légers, gratuits, adaptés à ton PC)
| Couche | Techno | Pourquoi |
|---|---|---|
| Frontend | **React + Vite** + **react-leaflet** | tu connais JS ; Leaflet = cartes gratuites |
| Cartes | **OpenStreetMap** (tuiles) | gratuit, pas de clé API |
| Backend | **Node.js + Express** | même langage que le front (JS) |
| Géocodage | **Nominatim** (API publique OSM) | adresse → coordonnées, gratuit |
| Distances + tracé | **OSRM** (serveur démo public en dev) | matrice + itinéraire réels |
| Base de données | **SQLite** (dev) → PostgreSQL (prod) | simple, pas de serveur à gérer |
| Algo TSP | **JavaScript pur (toi)** | c'est le cœur à montrer |

### À installer (commandes)
```bash
# 1. Node.js (via nvm, propre et sans sudo)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# rouvrir le terminal, puis :
nvm install --lts
node -v && npm -v

# 2. Créer le projet frontend
npm create vite@latest routebenin-web -- --template react
cd routebenin-web && npm install
npm install leaflet react-leaflet

# 3. Backend (dans un autre dossier)
mkdir routebenin-api && cd routebenin-api && npm init -y
npm install express cors better-sqlite3 node-fetch

# 4. (Optionnel, avancé) héberger OSRM toi-même avec Docker + carte du Bénin
#    carte : https://download.geofabrik.de/africa/benin.html
#    sinon : utiliser le serveur public https://router.project-osrm.org en dev
```

> Note : le serveur OSRM public est limité (dev uniquement). Pour la démo finale et pour
> impressionner, héberge ta propre instance OSRM avec la carte du Bénin (Docker) — ça
> montre que tu maîtrises le déploiement.

---

## 7. Plan de développement étape par étape

### Phase 0 — Mise en place (1–2 jours)
- Installer Node, créer les 2 dossiers (web + api), versionner avec **git**.
- Afficher une carte Leaflet centrée sur Cotonou.

### Phase 1 — Saisie des points (2–3 jours)
- Ajouter un point par clic sur la carte (marqueur).
- Barre de recherche d'adresse → appel Nominatim → marqueur.
- Liste des points + suppression + choix du départ.

### Phase 2 — Cœur algorithmique (le plus important, 3–5 jours)
- Backend : endpoint `/matrix` qui calcule la matrice de distances
  (commence en **Haversine** pour aller vite, puis branche **OSRM `/table`**).
- Coder **Plus Proche Voisin**, puis **2-opt**. Tester sur des cas connus.
- Endpoint `/optimize` qui renvoie l'ordre optimal + distance.

### Phase 3 — Affichage de l'itinéraire (2 jours)
- Appel OSRM `/route` pour le tracé réel → polyligne sur la carte.
- Numéroter les marqueurs dans l'ordre optimisé.
- Afficher **« distance avant X km → après Y km, gain Z % »**.

### Phase 4 — Sauvegarde & finitions (2 jours)
- Sauvegarder/charger une tournée (SQLite).
- Responsive mobile (un livreur est sur son téléphone).
- Soigner l'UI.

### Phase 5 — Bonus (si le temps le permet)
- Multi-livreurs (VRP / Clarke-Wright).
- Mode PWA hors-ligne.
- Export feuille de route PDF / WhatsApp.

### Phase 6 — Mémoire & démo
- Rédiger la partie algo (modélisation graphe, TSP, NN, 2-opt, complexité).
- Préparer un jeu de 15 adresses réelles de Cotonou pour la démo live.
- Graphiques : gain % et temps de calcul selon N.

---

## 8. Ce qui impressionne le jury (à préparer)
1. **Démo live** : saisir 15 points, cliquer, voir l'itinéraire se tracer + le gain affiché.
2. **La comparaison visuelle** naïf vs optimisé (deux tracés superposés).
3. **La maîtrise théorique** : savoir expliquer pourquoi le TSP est NP-difficile, et
   pourquoi NN+2-opt est un bon compromis.
4. **Ton propre code d'algo** (pas une librairie) + les mesures de performance.
5. **Le déploiement OSRM** avec la carte réelle du Bénin.

---

## 9. Pièges à éviter
- ❌ Utiliser une librairie qui résout le TSP pour toi → le jury verra qu'il n'y a pas de travail algorithmique.
- ❌ Rester en distance à vol d'oiseau pour la version finale → itinéraires peu crédibles.
- ❌ Spammer Nominatim/OSRM publics (quotas) → mets en cache, et héberge OSRM pour la démo.
- ❌ Vouloir tout faire (multi-livreurs, horaires…) avant que le MVP marche. **MVP d'abord.**

---

## 10. Pour aller plus loin (après la soutenance)
- Le proposer comme vrai service via **ATLANTIK WEB** (ton agence).
- Ajouter le suivi temps réel, les paiements, une appli livreur.
- Étendre à la région (Togo, Côte d'Ivoire — marché WAEMU).
