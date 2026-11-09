#!/usr/bin/env bash
# installer.sh — RouteBénin complet sur un VPS Ubuntu 24.04 (ou plus récent).
#
#   sudo ./installer.sh installer <domaine> <email-de-contact>
#       Node.js 22, application (API + interface sur la même origine, comptes
#       activés), OSRM du Bénin en local, https automatique (Caddy),
#       sauvegarde quotidienne de la base, pare-feu.
#       <domaine> : ex. routebenin.mon-domaine.bj, ou « auto » pour
#       <ip>.sslip.io (https valide sans acheter de nom de domaine).
#       <email-de-contact> : exigé par Nominatim (User-Agent) et Let's Encrypt.
#   sudo ./installer.sh mettre-a-jour
#       git pull, recompilation, mise à jour du schéma, redémarrage.
#   sudo ./installer.sh sauvegarder
#       copie immédiate de la base dans /var/backups/routebenin.
#
# Idempotent : relancer « installer » répare ou complète une installation.
set -euo pipefail

DEPOT="https://github.com/ADKfull-dev/routebenin.git"
APP=/opt/routebenin/app
DONNEES=/var/lib/routebenin
SAUVEGARDES=/var/backups/routebenin
ENV=/etc/routebenin.env
UTILISATEUR=routebenin

etape() { printf '\n\033[1m→ %s\033[0m\n' "$*"; }
exiger_root() { [ "$(id -u)" -eq 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }; }

installer_node() {
  if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then return; fi
  etape "Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

memoire_tampon() {
  # La compilation de l'interface demande ~1,5 Go : swap de 2 Go sur les petits VPS.
  local ram_mo; ram_mo=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ "$ram_mo" -lt 2500 ] && ! swapon --show | grep -q /swapfile; then
    etape "Swap de 2 Go (RAM : ${ram_mo} Mo)"
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

compiler() {
  etape "Compilation (serveur + interface)"
  cd "$APP"
  sudo -u "$UTILISATEUR" -H npm --prefix server ci --no-audit --no-fund
  sudo -u "$UTILISATEUR" -H npm --prefix client ci --no-audit --no-fund
  sudo -u "$UTILISATEUR" -H npm --prefix server run build
  sudo -u "$UTILISATEUR" -H npm --prefix client run build:serveur
  etape "Base de données"
  (cd server && sudo -u "$UTILISATEUR" -H env $(grep '^DATABASE_URL=' "$ENV") npx prisma generate >/dev/null)
  (cd server && sudo -u "$UTILISATEUR" -H env $(grep '^DATABASE_URL=' "$ENV") npx prisma db push --skip-generate)
}

installer() {
  exiger_root
  local domaine="${1:?Usage : sudo $0 installer <domaine|auto> <email-de-contact>}"
  local contact="${2:?Usage : sudo $0 installer <domaine|auto> <email-de-contact>}"
  if [ "$domaine" = auto ]; then
    domaine="$(curl -fsS4 https://api.ipify.org | tr . -).sslip.io"
  fi

  etape "Paquets système"
  apt-get update
  apt-get install -y curl git sqlite3 ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
  fi
  installer_node
  memoire_tampon

  etape "Utilisateur et dossiers"
  id "$UTILISATEUR" >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/routebenin --shell /usr/sbin/nologin "$UTILISATEUR"
  mkdir -p "$DONNEES" "$SAUVEGARDES"
  chown "$UTILISATEUR": "$DONNEES" /opt/routebenin
  chmod 700 "$DONNEES" "$SAUVEGARDES"
  if [ -d "$APP/.git" ]; then
    sudo -u "$UTILISATEUR" -H git -C "$APP" pull --ff-only
  else
    sudo -u "$UTILISATEUR" -H git clone "$DEPOT" "$APP"
  fi

  etape "Configuration ($ENV)"
  if [ ! -f "$ENV" ]; then
    cat > "$ENV" <<CONF
# RouteBénin — configuration de production (voir server/.env.example)
NODE_ENV=production
PORT=3001
DATABASE_URL=file:$DONNEES/routebenin.db
CLIENT_DIST=$APP/client/dist-serveur
CLIENT_ORIGIN=https://$domaine
COMPTES=oui
INSCRIPTIONS=ouvertes
COOKIE_SECURISE=oui
OSRM_URL=http://127.0.0.1:5000
OSRM_URL_SECOURS=https://router.project-osrm.org
NOMINATIM_USER_AGENT=RouteBenin/1.0 (contact: $contact)
GEOCODE_COUNTRYCODES=bj
CONF
    chmod 640 "$ENV" && chown root:"$UTILISATEUR" "$ENV"
  else
    echo "Existe déjà : conservé tel quel."
  fi

  compiler

  etape "OSRM du Bénin (local, 127.0.0.1:5000)"
  bash "$APP/deploy/osrm/osrm.sh" installer-service

  etape "Service routebenin"
  cat > /etc/systemd/system/routebenin.service <<UNIT
[Unit]
Description=RouteBénin — API et interface
After=network.target routebenin-osrm.service

[Service]
User=$UTILISATEUR
WorkingDirectory=$APP/server
EnvironmentFile=$ENV
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DONNEES
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

  etape "Sauvegarde quotidienne (3 h 30, 14 jours gardés)"
  cp "$(readlink -f "$0")" /usr/local/sbin/routebenin && chmod 755 /usr/local/sbin/routebenin
  cat > /etc/systemd/system/routebenin-sauvegarde.service <<UNIT
[Unit]
Description=RouteBénin — sauvegarde de la base

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/routebenin sauvegarder
UNIT
  cat > /etc/systemd/system/routebenin-sauvegarde.timer <<UNIT
[Unit]
Description=RouteBénin — sauvegarde quotidienne

[Timer]
OnCalendar=*-*-* 03:30
Persistent=true

[Install]
WantedBy=timers.target
UNIT

  etape "HTTPS (Caddy) pour $domaine"
  cat > /etc/caddy/Caddyfile <<CADDY
{
	email $contact
}

$domaine {
	encode gzip
	header Strict-Transport-Security "max-age=31536000"
	reverse_proxy 127.0.0.1:3001
}
CADDY

  if command -v ufw >/dev/null; then
    etape "Pare-feu"
    ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
  fi

  systemctl daemon-reload
  systemctl enable --now routebenin routebenin-sauvegarde.timer
  systemctl restart routebenin
  systemctl reload caddy || systemctl restart caddy

  etape "Vérification"
  for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS http://127.0.0.1:3001/api/auth/etat && echo
  echo
  echo "✓ RouteBénin est en ligne : https://$domaine"
  echo "  Créez le premier compte entreprise sur https://$domaine/#/connexion"
  echo "  Puis, si vous ne voulez pas d'inscriptions libres : INSCRIPTIONS=fermees dans $ENV"
  echo "  et « sudo systemctl restart routebenin »."
}

mettre_a_jour() {
  exiger_root
  sudo -u "$UTILISATEUR" -H git -C "$APP" pull --ff-only
  sauvegarder
  compiler
  cp "$APP/deploy/serveur/installer.sh" /usr/local/sbin/routebenin && chmod 755 /usr/local/sbin/routebenin
  systemctl restart routebenin
  echo "✓ Mis à jour : $(sudo -u "$UTILISATEUR" git -C "$APP" log -1 --format="%h %s")"
}

sauvegarder() {
  exiger_root
  local base; base="$(grep '^DATABASE_URL=' "$ENV" | sed 's/^DATABASE_URL=file://')"
  [ -f "$base" ] || { echo "Pas encore de base à sauvegarder."; return; }
  local cible="$SAUVEGARDES/routebenin-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$base" ".backup '$cible'"   # copie cohérente même en cours d'utilisation
  gzip "$cible"
  find "$SAUVEGARDES" -name 'routebenin-*.db.gz' -mtime +14 -delete
  echo "✓ Sauvegarde : $cible.gz"
}

case "${1:-}" in
  installer) shift; installer "$@" ;;
  mettre-a-jour) mettre_a_jour ;;
  sauvegarder) sauvegarder ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
