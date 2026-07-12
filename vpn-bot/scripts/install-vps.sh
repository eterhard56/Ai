#!/bin/bash
# Deploy VPN Telegram Bot to /opt/vpn-bot (standalone, does not touch other services)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/vpn-bot}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

echo "==> Installing VPN Bot to ${INSTALL_DIR}"
sudo mkdir -p "${INSTALL_DIR}"
sudo rsync -a --delete \
  --exclude '.env' \
  --exclude 'logs/*' \
  --exclude '__pycache__' \
  --exclude '.git' \
  "${REPO_DIR}/" "${INSTALL_DIR}/"

if [ ! -f "${INSTALL_DIR}/.env" ]; then
  sudo cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
  PASS=$(openssl rand -hex 16)
  sudo sed -i "s/change_me_strong_password/${PASS}/" "${INSTALL_DIR}/.env"
  echo "Created ${INSTALL_DIR}/.env — set BOT_TOKEN and ADMIN_IDS!"
fi

cd "${INSTALL_DIR}"
sudo docker compose --profile migrate run --rm migrator
sudo docker compose up -d --build

echo "==> VPN Bot deployed. Logs: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f bot"
