#!/bin/bash
set -euo pipefail

# Remote deployment script for AI Platform VPS
# Run locally: bash scripts/deploy-vps.sh

VPS_HOST="${VPS_HOST:-153.80.246.217}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_platform_deploy}"
INSTALL_DIR="/opt/ai-platform"
REPO_URL="https://github.com/eterhard56/Ai.git"
BRANCH="cursor/ai-platform-local-agents-7126"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

echo "=== Deploying AI Platform to ${VPS_USER}@${VPS_HOST} ==="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s << 'REMOTE'
set -euo pipefail
INSTALL_DIR="/opt/ai-platform"

# Install Docker if missing
if ! command -v docker &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Install Ollama if missing
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
  systemctl enable ollama
  systemctl start ollama
fi

mkdir -p "$INSTALL_DIR"
REMOTE

echo "Syncing project files..."
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'frontend/.next' \
  --exclude '__pycache__' \
  --exclude '.env' \
  --exclude 'logs/*' \
  --exclude 'backups/*' \
  /workspace/ "${VPS_USER}@${VPS_HOST}:${INSTALL_DIR}/"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s << 'REMOTE'
set -euo pipefail
cd /opt/ai-platform

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(openssl rand -hex 32)
  JWT=$(openssl rand -hex 32)
  DB=$(openssl rand -hex 16)
  sed -i "s/change-me-to-random-64-char-string/${SECRET}/" .env
  sed -i "s/change-me-jwt-secret-key/${JWT}/" .env
  sed -i "s/change-me-strong-password/${DB}/" .env
fi

mkdir -p logs/{backend,celery,nginx,agents/{direct,seo,analytics,crm,parser,telegram}} storage backups config/plugins

# Pull Ollama model in background
(ollama pull qwen3:8b || true) &

docker compose down 2>/dev/null || true
docker compose up -d --build

# Systemd autostart
cat > /etc/systemd/system/ai-platform.service << 'EOF'
[Unit]
Description=AI Platform
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ai-platform
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-platform.service

echo "=== Deployment complete ==="
docker compose ps
REMOTE

echo ""
echo "✅ Platform deployed!"
echo "   Web UI:  http://${VPS_HOST}"
echo "   API:     http://${VPS_HOST}/docs"
echo "   Login:   admin / admin123"
