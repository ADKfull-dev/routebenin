# Benchmarks du moteur d'optimisation

> Fichier généré par `npm run bench` (dossier `server/`) le 2026-11-06 — Node v22.11.0.
> Ne pas modifier à la main : relancer le script.

**Protocole.** Instances = points aléatoires (générateur à graine fixe, donc
reproductibles) dans l'emprise Cotonou / Abomey-Calavi ; distances Haversine.
Les trois variantes exécutent **le code même de l'application**
(`server/src/algorithms/tsp.ts`) :

| Variante | Description |
|---|---|
| Plus Proche Voisin seul | construction gloutonne, O(n²) |
| PPV + 2-opt | + décroisement des segments jusqu'à stabilité |
| **PPV + 2-opt + Or-opt (RouteBénin)** | + déplacement de points isolés, alterné avec 2-opt |

## 1. Qualité : écart à l'optimum exact

Référence = **force brute** (toutes les (n−1)! permutations).

![Écart à l'optimum](qualite.svg)

| N | Instances | PPV + 2-opt + Or-opt — écart moyen / max | PPV seul — écart moyen / max | PPV + 2-opt — écart moyen / max | Optimum atteint (RouteBénin) |
|---|---|---|---|---|---|
| 5 | 30 | 0 % / 0 % | 3,37 % / 24,6 % | 0 % / 0 % | 100 % |
| 6 | 30 | 0 % / 0 % | 6,35 % / 21,6 % | 0,04 % / 1,31 % | 100 % |
| 7 | 30 | 0,19 % / 2,96 % | 7,82 % / 35,75 % | 0,19 % / 2,96 % | 93 % |
| 8 | 30 | 0,21 % / 2,75 % | 6,58 % / 16,7 % | 0,82 % / 9,99 % | 90 % |
| 9 | 30 | 0 % / 0 % | 10,82 % / 32,5 % | 0,38 % / 5,5 % | 100 % |
| 10 | 10 | 0,01 % / 0,14 % | 6,98 % / 12,77 % | 0,72 % / 6,17 % | 90 % |

## 2. Temps de calcul

![Temps de calcul](temps.svg)

| N | PPV + 2-opt + Or-opt (ms) | PPV seul (ms) | PPV + 2-opt (ms) | Gain de la méthode complète vs PPV seul |
|---|---|---|---|---|
| 10 | 0,01 | 0 | 0,01 | 8,03 % |
| 20 | 0,04 | 0,01 | 0,02 | 17,42 % |
| 30 | 0,08 | 0,01 | 0,06 | 10,9 % |
| 50 | 0,26 | 0,03 | 0,12 | 13,5 % |
| 75 | 0,99 | 0,06 | 0,29 | 16,99 % |
| 100 | 1,67 | 0,11 | 0,59 | 12,44 % |
| 150 | 5,47 | 0,24 | 1,37 | 14,98 % |
| 200 | 14,09 | 0,43 | 2,93 | 17,08 % |

## 3. Gain par rapport à l'ordre de saisie

C'est le chiffre affiché à l'utilisateur (« Avant → Après »). L'ordre de saisie
est ici aléatoire ; un livreur qui saisit ses adresses « au hasard » obtient
ce type de gain.

![Gain vs ordre de saisie](gain.svg)

| N | Gain moyen | Min | Max |
|---|---|---|---|
| 5 | 15,8 % | 0 % | 37,7 % |
| 10 | 46 % | 32,7 % | 61,2 % |
| 15 | 55,4 % | 40,9 % | 67,3 % |
| 20 | 61,8 % | 50,1 % | 71,8 % |
| 30 | 69,6 % | 63,1 % | 77,1 % |
| 50 | 77,4 % | 73,2 % | 80,3 % |

## Lecture pour le mémoire

- Le **PPV seul** est rapide mais s'éloigne de l'optimum dès quelques points.
- **2-opt** supprime l'essentiel de cet écart ; **Or-opt** corrige les cas
  résiduels qu'un simple décroisement ne voit pas.
- Le temps de calcul reste **bien en dessous de la milliseconde** pour une
  tournée réaliste (10 à 30 points), et de l'ordre de 15 ms à 200 points. Il
  croît de façon polynomiale, sans l'explosion factorielle de la force brute.
  L'utilisateur attend surtout les appels OSRM, pas l'algorithme.
- La méthode complète n'est pas exacte (heuristique) : elle rate parfois
  l'optimum de quelques dixièmes de pourcent — à comparer au coût de la force
  brute, inutilisable au-delà d'une dizaine de points.

Données brutes : `resultats.json`, `qualite.csv`, `temps.csv`, `gain.csv`.
