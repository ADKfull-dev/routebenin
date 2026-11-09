# Serveur d'itinéraires OSRM auto-hébergé (Bénin)

Par défaut, RouteBénin calcule les distances routières avec le serveur OSRM
public de démonstration : gratuit, mais sans garantie de disponibilité et
limité à 100 points par matrice. Ce dossier permet d'héberger **votre propre
OSRM, pour tout le Bénin**, sans Docker :

| | |
|---|---|
| Préparation de la carte | ~1 min, ~700 Mo de RAM au pic |
| Serveur en marche | ~200 Mo de RAM, ~350 Mo de disque |
| Matrice de 150 points | ~0,7 s (limite : 200 points) |
| Système | Linux x86-64, Ubuntu 24.04 ou plus récent (glibc ≥ 2.38), Node.js ≥ 18 |

Les binaires viennent du paquet npm officiel `@project-osrm/osrm` ; la carte,
d'OpenStreetMap via Geofabrik (`africa/benin-latest.osm.pbf`).

## Sur votre ordinateur

```bash
npm run osrm:preparer   # une fois (puis quand vous voulez rafraîchir la carte)
npm run osrm:lancer     # serveur sur http://localhost:5000
```

Puis :

- **mode full-stack** : `OSRM_URL=http://localhost:5000` dans `server/.env`
  (le serveur public reste en secours via `OSRM_URL_SECOURS`) ;
- **mode navigateur** (GitHub Pages) : Paramètres → « Serveur d'itinéraires »
  → `http://localhost:5000` → Tester → Enregistrer. Le navigateur accepte
  `http://localhost` depuis une page https ; pour un autre appareil, il faut
  du https (voir ci-dessous).

## Sur un serveur (VPS)

Un petit VPS à 1 Go de RAM suffit. Pointez un nom de domaine
(ex. `osrm.mon-entreprise.bj`) vers son adresse IP, puis :

```bash
git clone https://github.com/ADKfull-dev/routebenin.git
cd routebenin/deploy/osrm
sudo ./osrm.sh installer-serveur osrm.mon-entreprise.bj
```

Le script :

1. crée l'utilisateur système `osrm` et `/opt/routebenin-osrm` ;
2. installe OSRM et prépare la carte du Bénin ;
3. crée le service `routebenin-osrm` (redémarrage automatique) ;
4. met la carte à jour chaque dimanche à 3 h (`routebenin-osrm-maj.timer`),
   sans coupure : la nouvelle carte est préparée à côté puis échangée ;
5. installe Caddy, qui fournit le https (certificat Let's Encrypt automatique).

Ensuite, mettez `https://osrm.mon-entreprise.bj` dans les Paramètres de
l'application (mode navigateur) ou dans `OSRM_URL` (mode full-stack).

Commandes utiles : `systemctl status routebenin-osrm`,
`journalctl -u routebenin-osrm -f`, `sudo systemctl start routebenin-osrm-maj`
(mise à jour immédiate de la carte), `cat /opt/routebenin-osrm/carte/PREPAREE_LE`.

## Ordre d'essai des serveurs

L'application essaie les serveurs dans l'ordre et passe au suivant en cas
d'échec. Si aucun ne répond, elle calcule à vol d'oiseau.

- navigateur : serveur des Paramètres → `VITE_OSRM_URL` (à la compilation) → serveur public ;
- full-stack : `OSRM_URL` → `OSRM_URL_SECOURS`.
