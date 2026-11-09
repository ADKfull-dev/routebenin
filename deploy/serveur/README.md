# RouteBénin sur un VPS (comptes, entreprises, OSRM)

Un seul script installe la version complète sur un VPS **Ubuntu 24.04** (ou
plus récent), 1 Go de RAM minimum (2 Go conseillés) :

```bash
git clone https://github.com/ADKfull-dev/routebenin.git
sudo routebenin/deploy/serveur/installer.sh installer routebenin.mon-domaine.bj contact@mon-domaine.bj
```

`auto` à la place du domaine donne une adresse `<ip>.sslip.io` en https valide,
sans acheter de nom de domaine (pratique pour commencer).

Ce qui est installé :

| | |
|---|---|
| Application | API + interface sur la même origine, `COMPTES=oui`, service `routebenin` (port 3001 local) |
| Base | SQLite dans `/var/lib/routebenin/routebenin.db` |
| Itinéraires | OSRM du Bénin, local (`127.0.0.1:5000`), carte mise à jour chaque dimanche ; serveur public en secours |
| HTTPS | Caddy, certificat Let's Encrypt automatique |
| Sauvegardes | chaque nuit à 3 h 30 dans `/var/backups/routebenin`, 14 jours |
| Sécurité | utilisateur système dédié, service confiné (systemd), pare-feu ufw (22, 80, 443) |
| Configuration | `/etc/routebenin.env` (voir `server/.env.example`) |

Ensuite : créez le premier compte entreprise sur `https://<domaine>/#/connexion`.
Pour fermer les inscriptions libres : `INSCRIPTIONS=fermees` dans
`/etc/routebenin.env`, puis `sudo systemctl restart routebenin`.

Au quotidien :

```bash
sudo routebenin mettre-a-jour      # git pull + sauvegarde + recompilation + redémarrage
sudo routebenin sauvegarder        # sauvegarde immédiate
journalctl -u routebenin -f        # journaux
systemctl status routebenin routebenin-osrm caddy
```

Restaurer une sauvegarde : `sudo systemctl stop routebenin`, puis
`gunzip -c /var/backups/routebenin/routebenin-AAAAMMJJ-HHMMSS.db.gz > /var/lib/routebenin/routebenin.db`,
`sudo chown routebenin: /var/lib/routebenin/routebenin.db`, `sudo systemctl start routebenin`.
