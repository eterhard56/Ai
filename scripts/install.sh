#!/bin/bash
set -euo pipefail

# AI Platform VPS Installation Script
# Usage: sudo bash scripts/install.sh

INSTALL_DIR="/opt/ai-platform"
REPO_URL="${REPO_URL:-}"

echo "======================================"
echo "  AI Platform Installation"
echo "======================================"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash scripts/install.sh"
    exit 1
fi

# Install dependencies
echo "[1/8] Installing system dependencies..."
apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "[2/8] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "[2/8] Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "[3/8] Installing Docker Compose..."
    apt-get install -y docker-compose-plugin
else
    echo "[3/8] Docker Compose already installed"
fi

# Install Ollama (systemd service on host)
if ! command -v ollama &> /dev/null; then
    echo "[4/8] Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "[4/8] Ollama already installed"
fi

# Create Ollama systemd override for host networking (optional)
cat > /etc/systemd/system/ollama.service.d/override.conf 2>/dev/null << 'EOF' || true
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl start ollama

# Pull model
echo "[5/8] Pulling qwen3:8b model (this may take a while)..."
ollama pull qwen3:8b || echo "Warning: Model pull failed, will retry via docker-compose"

# Setup project directory
echo "[6/8] Setting up project at ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"

if [ -n "$REPO_URL" ]; then
    git clone "$REPO_URL" "${INSTALL_DIR}" || true
elif [ "$(pwd)" != "${INSTALL_DIR}" ] && [ -d "$(pwd)/docker-compose.yml" ] || [ -f "$(pwd)/docker-compose.yml" ]; then
    rsync -a --exclude='.git' "$(pwd)/" "${INSTALL_DIR}/"
fi

cd "${INSTALL_DIR}"

# Create directories
mkdir -p logs/{backend,celery,nginx,agents/{direct,seo,analytics,crm,parser,telegram}}
mkdir -p storage/parser backups config/plugins

# Setup environment
if [ ! -f .env ]; then
    cp .env.example .env
    SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASS=$(openssl rand -hex 16)
    sed -i "s/change-me-to-random-64-char-string/${SECRET}/" .env
    sed -i "s/change-me-jwt-secret-key/${JWT_SECRET}/" .env
    sed -i "s/change-me-strong-password/${DB_PASS}/" .env
    echo "Generated .env with random secrets"
fi

# Setup systemd service for docker compose
echo "[7/8] Creating systemd service..."
cat > /etc/systemd/system/ai-platform.service << EOF
[Unit]
Description=AI Platform Docker Compose
Requires=docker.service ollama.service
After=docker.service ollama.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --build
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-platform.service

# Firewall
echo "[8/8] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable || true

# Start platform
echo "Starting AI Platform..."
docker compose up -d --build

echo ""
echo "======================================"
echo "  Installation Complete!"
echo "======================================"
echo ""
echo "  Web UI:    http://$(hostname -I | awk '{print $1}')"
echo "  API Docs:  http://$(hostname -I | awk '{print $1}')/docs"
echo "  Login:     admin / admin123"
echo ""
echo "  Commands:"
echo "    systemctl status ai-platform"
echo "    docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
echo "    docker compose -f ${INSTALL_DIR}/docker-compose.yml ps"
echo ""
echo "  Edit config: ${INSTALL_DIR}/.env"
echo "======================================"
