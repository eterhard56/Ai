#!/bin/bash
# Deploy 3X-UI + Xray VLESS Reality for Happ — safe install
set -euo pipefail

INSTALL_DIR="/opt/xray-service"
LOG_FILE="$INSTALL_DIR/logs/install.log"
mkdir -p "$INSTALL_DIR"/{configs,backup,logs,data/db,data/cert}
exec > >(tee -a "$LOG_FILE") 2>&1

log() { echo "[$(date -Iseconds)] $*"; }

backup_file() {
  local f="$1"
  [ -f "$f" ] && cp -a "$f" "$INSTALL_DIR/backup/$(basename "$f").$(date +%Y%m%d_%H%M%S).bak"
}

log "=== Xray service install start ==="

# --- BBR + TCP Fast Open (new sysctl drop-in only) ---
backup_file /etc/sysctl.d/99-xray-tuning.conf
cat > /etc/sysctl.d/99-xray-tuning.conf << 'SYS'
# Xray VPN tuning (added by xray-service)
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.tcp_fastopen=3
SYS
sysctl -p /etc/sysctl.d/99-xray-tuning.conf || true

# --- Credentials ---
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
PANEL_PASS="${XUI_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9!@#%' | head -c 18)}"
CLIENT_UUID=$(cat /proc/sys/kernel/random/uuid)
SHORT_ID=$(openssl rand -hex 4)
INBOUND_PORT=8444
PANEL_PORT=2053
PUBLIC_PANEL_PORT=2083
SUB_PORT=2087
REALITY_DEST="www.microsoft.com:443"
REALITY_SNI="www.microsoft.com"
REALITY_FP="chrome"

cat > "$INSTALL_DIR/.env" << EOF
XUI_PANEL_PORT=${PANEL_PORT}
XUI_PUBLIC_PORT=${PUBLIC_PANEL_PORT}
XRAY_INBOUND_PORT=${INBOUND_PORT}
XUI_USERNAME=admin
XUI_PASSWORD=${PANEL_PASS}
REALITY_DEST=${REALITY_DEST}
REALITY_SNI=${REALITY_SNI}
REALITY_FINGERPRINT=${REALITY_FP}
SUB_PORT=${SUB_PORT}
SERVER_IP=${SERVER_IP}
EOF
chmod 600 "$INSTALL_DIR/.env"

log "Server IP: $SERVER_IP"

# --- Docker compose up ---
cd "$INSTALL_DIR"
docker compose pull
docker compose up -d

log "Waiting for 3X-UI..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PANEL_PORT}/" >/dev/null 2>&1; then
    log "Panel is up after ${i}s"
    break
  fi
  sleep 2
done

# --- Generate Reality keys via xray in container ---
KEYS=$(docker exec xray-3x-ui xray x25519 2>/dev/null || docker exec xray-3x-ui /usr/local/bin/xray x25519 2>/dev/null)
PRIV_KEY=$(echo "$KEYS" | grep -i "PrivateKey\|Private key" | awk '{print $NF}')
PUB_KEY=$(echo "$KEYS" | grep -i "Password\|Public key" | awk '{print $NF}')
if [ -z "$PRIV_KEY" ] || [ -z "$PUB_KEY" ]; then
  KEYS=$(docker exec xray-3x-ui sh -c 'xray x25519' 2>/dev/null)
  PRIV_KEY=$(echo "$KEYS" | sed -n '1p' | awk '{print $3}')
  PUB_KEY=$(echo "$KEYS" | sed -n '2p' | awk '{print $3}')
fi
log "Reality keys generated"

# --- Configure via Python API script ---
python3 "$INSTALL_DIR/scripts/configure-3xui.py" \
  --host "127.0.0.1" \
  --port "$PANEL_PORT" \
  --username "admin" \
  --old-password "admin" \
  --new-password "$PANEL_PASS" \
  --inbound-port "$INBOUND_PORT" \
  --client-uuid "$CLIENT_UUID" \
  --client-email "admin" \
  --short-id "$SHORT_ID" \
  --private-key "$PRIV_KEY" \
  --public-key "$PUB_KEY" \
  --reality-dest "$REALITY_DEST" \
  --reality-sni "$REALITY_SNI" \
  --fingerprint "$REALITY_FP" \
  --server-ip "$SERVER_IP"

# --- Save credentials ---
cat > "$INSTALL_DIR/configs/credentials.txt" << CREDS
Server IP: ${SERVER_IP}
Panel URL: http://${SERVER_IP}:${PUBLIC_PANEL_PORT}/
Panel Login: admin
Panel Password: ${PANEL_PASS}
Client Name: admin
UUID: ${CLIENT_UUID}
Private Key: ${PRIV_KEY}
Public Key: ${PUB_KEY}
Short ID: ${SHORT_ID}
Reality Server Name (SNI): ${REALITY_SNI}
Reality Dest: ${REALITY_DEST}
Inbound Port: ${INBOUND_PORT}
Flow: xtls-rprx-vision
Fingerprint: ${REALITY_FP}
CREDS
chmod 600 "$INSTALL_DIR/configs/credentials.txt"

# --- Nginx separate vhost ---
backup_file /etc/nginx/sites-available/xray-service
cp "$INSTALL_DIR/configs/nginx-xray.conf" /etc/nginx/sites-available/xray-service
ln -sf /etc/nginx/sites-available/xray-service /etc/nginx/sites-enabled/xray-service
nginx -t
systemctl reload nginx

# --- systemd autostart on boot ---
cat > /etc/systemd/system/xray-service.service << UNIT
[Unit]
Description=Xray 3X-UI VPN Service (Docker Compose)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable xray-service.service

# --- Backup cron ---
echo "15 3 * * * root ${INSTALL_DIR}/scripts/backup.sh >> ${INSTALL_DIR}/logs/backup.log 2>&1" > /etc/cron.d/xray-service-backup
chmod 644 /etc/cron.d/xray-service-backup
"${INSTALL_DIR}/scripts/backup.sh" || true

# --- Generate outputs ---
python3 "$INSTALL_DIR/scripts/generate-links.py" \
  --credentials "$INSTALL_DIR/configs/credentials.txt" \
  --sub-port "$SUB_PORT" \
  --server-ip "$SERVER_IP" \
  --output "$INSTALL_DIR/configs/client-info.json"

log "=== Install complete ==="
