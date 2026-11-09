#!/usr/bin/env bash
# osrm.sh — serveur d'itinéraires OSRM pour le Bénin, sans Docker.
#
# Utilise les binaires précompilés du paquet npm @project-osrm/osrm
# (Linux x86-64, glibc ≥ 2.38 : Ubuntu 24.04 ou plus récent).
# Le Bénin entier se prépare en ~1 min avec ~700 Mo de RAM ; le serveur
# tourne ensuite avec ~200 Mo.
#
#   ./osrm.sh preparer [dossier]           télécharge la carte et la prépare
#   ./osrm.sh lancer   [dossier] [port]    lance le serveur (défaut : port 5000)
#   sudo ./osrm.sh installer-service        VPS : service systemd local (127.0.0.1:5000)
#                                          + mise à jour hebdomadaire de la carte
#   sudo ./osrm.sh installer-serveur <domaine>
#                                          VPS : service systemd + HTTPS (Caddy)
#                                          + mise à jour hebdomadaire de la carte
set -euo pipefail

VERSION_OSRM="26.6.5"
CARTE_URL="https://download.geofabrik.de/africa/benin-latest.osm.pbf"
DOSSIER_DEFAUT="${HOME}/.local/share/routebenin-osrm"

binaires() { echo "$1/node_modules/@project-osrm/osrm/lib/binding_napi_v8"; }

preparer() {
  local d="${1:-$DOSSIER_DEFAUT}"
  mkdir -p "$d"
  cd "$d"
  command -v npm >/dev/null || { echo "npm est requis (Node.js ≥ 18)." >&2; exit 1; }
  if [ ! -x "$(binaires "$d")/osrm-routed" ]; then
    echo "→ Installation d'OSRM ${VERSION_OSRM}…"
    [ -f package.json ] || echo '{"name":"routebenin-osrm","private":true}' > package.json
    npm install --no-audit --no-fund "@project-osrm/osrm@${VERSION_OSRM}"
  fi
  local b; b="$(binaires "$d")"
  "$b/osrm-routed" --version >/dev/null || {
    echo "Binaires OSRM incompatibles avec ce système (glibc ≥ 2.38 requise)." >&2; exit 1; }

  # Préparation dans un sous-dossier temporaire, puis bascule : le serveur en
  # cours continue de répondre pendant la mise à jour.
  rm -rf travail && mkdir travail && cd travail
  echo "→ Téléchargement de la carte du Bénin (OpenStreetMap / Geofabrik)…"
  curl -fL --retry 3 -o benin.osm.pbf "$CARTE_URL"
  local profils="$d/node_modules/@project-osrm/osrm/profiles"
  echo "→ Préparation (extract, partition, customize)…"
  "$b/osrm-extract" -p "$profils/car.lua" benin.osm.pbf
  "$b/osrm-partition" benin.osrm
  "$b/osrm-customize" benin.osrm
  rm benin.osm.pbf
  cd "$d"
  rm -rf carte && mv travail carte
  date -Iseconds > carte/PREPAREE_LE
  echo "✓ Carte prête dans $d/carte"
}

lancer() {
  local d="${1:-$DOSSIER_DEFAUT}" port="${2:-5000}"
  [ -f "$d/carte/benin.osrm.mldgr" ] || { echo "Carte absente : lancez d'abord « $0 preparer $d »." >&2; exit 1; }
  # --max-table-size : matrices jusqu'à 200 points (le serveur public limite à 100).
  exec "$(binaires "$d")/osrm-routed" --algorithm mld --ip 127.0.0.1 --port "$port" \
    --max-table-size 200 "$d/carte/benin.osrm"
}

# Service systemd + mise à jour hebdomadaire, OSRM n'écoutant qu'en local
# (utilisé par deploy/serveur/installer.sh : l'API appelle OSRM en direct).
installer_service() {
  [ "$(id -u)" -eq 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
  local d=/opt/routebenin-osrm script
  script="$(readlink -f "$0")"
  id osrm >/dev/null 2>&1 || useradd --system --home "$d" --shell /usr/sbin/nologin osrm
  mkdir -p "$d" && cp "$script" "$d/osrm.sh" && chmod +x "$d/osrm.sh" && chown -R osrm: "$d"
  sudo -u osrm HOME="$d" "$d/osrm.sh" preparer "$d"

  cat > /etc/systemd/system/routebenin-osrm.service <<UNIT
[Unit]
Description=RouteBénin — serveur d'itinéraires OSRM (Bénin)
After=network.target

[Service]
User=osrm
ExecStart=$d/osrm.sh lancer $d 5000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

  # Mise à jour hebdomadaire de la carte (dimanche 3 h), puis redémarrage.
  cat > /etc/systemd/system/routebenin-osrm-maj.service <<UNIT
[Unit]
Description=RouteBénin — mise à jour de la carte OSRM

[Service]
Type=oneshot
User=osrm
Environment=HOME=$d
ExecStart=$d/osrm.sh preparer $d
ExecStartPost=+/bin/systemctl restart routebenin-osrm
UNIT
  cat > /etc/systemd/system/routebenin-osrm-maj.timer <<UNIT
[Unit]
Description=RouteBénin — carte OSRM hebdomadaire

[Timer]
OnCalendar=Sun 03:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT

  systemctl daemon-reload
  systemctl enable --now routebenin-osrm routebenin-osrm-maj.timer
  echo "✓ OSRM en service sur 127.0.0.1:5000"
}

# OSRM seul, exposé en https (pour le mode navigateur / GitHub Pages).
installer_serveur() {
  local domaine="${1:?Usage : sudo $0 installer-serveur osrm.mon-domaine.bj}"
  installer_service
  # HTTPS automatique (Let's Encrypt) devant OSRM (qui envoie déjà les en-têtes CORS) et n'écoute qu'en local.
  if ! command -v caddy >/dev/null; then
    apt-get update && apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile <<CADDY
$domaine {
	encode gzip
	reverse_proxy 127.0.0.1:5000
}
CADDY
  systemctl reload caddy || systemctl restart caddy
  echo "✓ OSRM en ligne : https://$domaine"
  echo "  Test : curl 'https://$domaine/route/v1/driving/2.4183,6.3654;2.3912,6.3703?overview=false'"
}

case "${1:-}" in
  preparer) shift; preparer "$@" ;;
  lancer) shift; lancer "$@" ;;
  installer-service) shift; installer_service "$@" ;;
  installer-serveur) shift; installer_serveur "$@" ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
