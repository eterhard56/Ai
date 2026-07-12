#!/bin/bash
# Safe VPN deployment — does NOT modify existing nginx configs or restart other projects
set -euo pipefail

INSTALL_DIR="/opt/vpn-service"
WG_PASSWORD="${WG_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)}"

echo "=== [1/10] Install Docker (if missing) ==="
if ! command -v docker &>/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2 wireguard-tools 2>/dev/null
  systemctl enable docker
  systemctl start docker
  echo "Docker installed and started"
else
  echo "Docker already present"
fi

echo "=== [2/10] Enable IP forwarding (VPN only sysctl drop-in) ==="
cat > /etc/sysctl.d/99-vpn-forward.conf << 'SYSCTL'
# Required for WireGuard VPN routing (added by vpn-service deploy)
net.ipv4.ip_forward=1
SYSCTL
sysctl -p /etc/sysctl.d/99-vpn-forward.conf

echo "=== [3/10] Create directory structure ==="
mkdir -p "$INSTALL_DIR"/{backups,logs,configs,data,scripts}
chmod 700 "$INSTALL_DIR"
chmod 700 "$INSTALL_DIR/data"

echo "=== [4/10] Sync compose and configs ==="
# Files must be rsynced before this script runs

echo "=== [5/10] Generate password and compose with bcrypt hash ==="
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# bcrypt hash with $$ escaping — must not pass through shell .env interpolation
docker run --rm ghcr.io/wg-easy/wg-easy:14 node -e '
const bcrypt=require("bcryptjs");
const h=bcrypt.hashSync(process.argv[1],10);
process.stdout.write(h.replace(/\$/g,"$$$$"));
' "$WG_PASSWORD" > /tmp/wg-hash.txt

python3 - "$INSTALL_DIR" "$PUBLIC_IP" << 'PY'
import sys
from pathlib import Path

install_dir, public_ip = sys.argv[1], sys.argv[2]
h = Path("/tmp/wg-hash.txt").read_text().strip()
compose = f"""services:
  wg-easy:
    image: ghcr.io/wg-easy/wg-easy:14
    container_name: vpn-wg-easy
    hostname: vpn-wg-easy
    networks:
      - vpn-network
    environment:
      LANG: ru
      WG_HOST: {public_ip}
      PASSWORD_HASH: '{h}'
      PORT: "51821"
      WG_PORT: "51820"
      WG_DEFAULT_DNS: 1.1.1.1,8.8.8.8
      WG_ALLOWED_IPS: 0.0.0.0/0,::/0
      WG_PERSISTENT_KEEPALIVE: "25"
      UI_TRAFFIC_STATS: "true"
    volumes:
      - ./data:/etc/wireguard
    ports:
      - "51820:51820/udp"
      - "127.0.0.1:51821:51821/tcp"
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      net.ipv4.ip_forward: "1"
      net.ipv4.conf.all.src_valid_mark: "1"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:51821/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

networks:
  vpn-network:
    name: vpn-network
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24
"""
Path(install_dir, "docker-compose.yml").write_text(compose)
PY

cat > "$INSTALL_DIR/.env" << EOF
WG_HOST=${PUBLIC_IP}
WG_PORT=51820
WG_UI_PORT=51821
VPN_NGINX_PORT=9443
EOF
chmod 600 "$INSTALL_DIR/.env"
echo "$WG_PASSWORD" > "$INSTALL_DIR/configs/initial-password.txt"
chmod 600 "$INSTALL_DIR/configs/initial-password.txt"

echo "=== [6/10] Create Docker network and start VPN ==="
cd "$INSTALL_DIR"
docker network rm vpn-network 2>/dev/null || true
docker compose pull
docker compose config
docker compose up -d

echo "=== [7/10] Install separate Nginx vhost (new file only) ==="
cp "$INSTALL_DIR/configs/nginx-vpn.conf" /etc/nginx/sites-available/vpn-service
ln -sf /etc/nginx/sites-available/vpn-service /etc/nginx/sites-enabled/vpn-service
nginx -t
systemctl reload nginx

echo "=== [8/10] Backup cron (daily 03:30) ==="
chmod +x "$INSTALL_DIR/scripts/"*.sh
CRON_LINE="30 3 * * * root $INSTALL_DIR/scripts/backup.sh >> $INSTALL_DIR/logs/backup.log 2>&1"
grep -qF "$INSTALL_DIR/scripts/backup.sh" /etc/cron.d/vpn-service-backup 2>/dev/null || \
  echo "$CRON_LINE" > /etc/cron.d/vpn-service-backup
chmod 644 /etc/cron.d/vpn-service-backup

echo "=== [9/10] Initial backup ==="
"$INSTALL_DIR/scripts/backup.sh"

echo "=== [10/10] Health check ==="
sleep 8
"$INSTALL_DIR/scripts/healthcheck.sh"

echo ""
echo "DEPLOY_OK"
echo "WG_PASSWORD=$WG_PASSWORD"
echo "PUBLIC_IP=$PUBLIC_IP"
