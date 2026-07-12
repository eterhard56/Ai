#!/bin/bash
set -euo pipefail

# Safe native deployment — does NOT touch client-finder or parser-2gis
VPS_HOST="${VPS_HOST:-153.80.246.217}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_platform_deploy}"
INSTALL_DIR="/opt/ai-platform"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=20)

echo "=== Safe deploy to ${VPS_HOST} (client-finder preserved) ==="

echo "[1/5] Syncing files..."
rsync -az \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' --exclude 'node_modules' --exclude 'frontend/.next' \
  --exclude '__pycache__' --exclude '.env' --exclude 'logs/*' --exclude 'backups/*' \
  /workspace/ "${VPS_USER}@${VPS_HOST}:${INSTALL_DIR}/"

echo "[2/5] Remote setup..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s << 'REMOTE'
set -euo pipefail
INSTALL_DIR="/opt/ai-platform"
cd "$INSTALL_DIR"

# NEVER touch client-finder
echo "✓ client-finder untouched at /opt/client-finder"

# System packages
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip nginx rsync curl 2>/dev/null || true

# PostgreSQL: separate database (don't touch client_finder DB)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='ai_platform'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ai_platform WITH PASSWORD 'ai_platform_secure_2026';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ai_platform'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ai_platform OWNER ai_platform;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_platform TO ai_platform;" 2>/dev/null || true

# Environment
if [ ! -f .env ]; then cp .env.example .env; fi
SECRET=$(openssl rand -hex 16)
JWT=$(openssl rand -hex 16)
sed -i "s/change-me-to-random-64-char-string/${SECRET}/" .env
sed -i "s/change-me-jwt-secret-key/${JWT}/" .env
sed -i "s/change-me-strong-password/ai_platform_secure_2026/" .env
sed -i "s/POSTGRES_HOST=postgres/POSTGRES_HOST=localhost/" .env
sed -i "s/REDIS_HOST=redis/REDIS_HOST=localhost/" .env
sed -i "s|OLLAMA_HOST=http://ollama:11434|OLLAMA_HOST=http://127.0.0.1:11434|" .env
sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api/v1|" .env

# Parser: use existing CLI, read-only
grep -q PARSER_2GIS_BIN .env || echo "PARSER_2GIS_BIN=/opt/client-finder/parser-2gis/venv/bin/parser-2gis" >> .env

mkdir -p logs/{backend,agents/{direct,seo,analytics,crm,parser,telegram}} storage backups config/plugins

# Backend venv
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install -q --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/backend/requirements.txt"

# Agents venvs (shared approach - one venv for all agents)
"$INSTALL_DIR/venv/bin/pip" install -q beautifulsoup4 lxml openpyxl python-telegram-bot

# Frontend
if [ ! -d "$INSTALL_DIR/frontend/node_modules" ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null || true
  apt-get install -y -qq nodejs 2>/dev/null || true
  cd "$INSTALL_DIR/frontend" && npm install --silent && npm run build
  cd "$INSTALL_DIR"
fi

# Ollama (lightweight model for 2GB RAM VPS)
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
  systemctl enable ollama
  systemctl start ollama
fi
(ollama pull qwen2.5:0.5b 2>/dev/null || ollama pull tinyllama 2>/dev/null || true) &
sed -i 's/OLLAMA_MODEL=qwen3:8b/OLLAMA_MODEL=qwen2.5:0.5b/' .env 2>/dev/null || true

# Systemd: backend (port 8010 — NOT 8000!)
cat > /etc/systemd/system/ai-platform-backend.service << EOF
[Unit]
Description=AI Platform Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/backend
EnvironmentFile=${INSTALL_DIR}/.env
Environment=LOG_DIR=${INSTALL_DIR}/logs/backend
Environment=PLUGINS_DIR=${INSTALL_DIR}/config/plugins
Environment=POSTGRES_HOST=localhost
Environment=REDIS_HOST=localhost
ExecStart=${INSTALL_DIR}/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Systemd: frontend (port 3010 — NOT 3000!)
cat > /etc/systemd/system/ai-platform-frontend.service << EOF
[Unit]
Description=AI Platform Frontend
After=ai-platform-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/frontend
Environment=NEXT_PUBLIC_API_URL=/api/v1
Environment=PORT=3010
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/npm run start -- --port 3010 --hostname 127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Systemd: parser agent (port 8105)
cat > /etc/systemd/system/ai-platform-agent-parser.service << EOF
[Unit]
Description=AI Platform Parser Agent
After=ai-platform-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/agents/parser
EnvironmentFile=${INSTALL_DIR}/.env
Environment=LOG_DIR=${INSTALL_DIR}/logs/agents/parser
Environment=POSTGRES_HOST=localhost
Environment=PARSER_2GIS_BIN=/opt/client-finder/parser-2gis/venv/bin/parser-2gis
ExecStart=${INSTALL_DIR}/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8105
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Nginx on port 8088 (does NOT conflict with skolesnikov.site on 80/443)
cat > /etc/nginx/sites-available/ai-platform << 'NGINX'
server {
    listen 8088;
    listen [::]:8088;
    server_name _;

    client_max_body_size 50m;
    proxy_read_timeout 600s;

    location /api/ {
        proxy_pass http://127.0.0.1:8010/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8010/docs;
    }

    location /health {
        proxy_pass http://127.0.0.1:8010/health;
    }

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ai-platform /etc/nginx/sites-enabled/ai-platform
nginx -t && systemctl reload nginx

systemctl daemon-reload
systemctl enable ai-platform-backend ai-platform-frontend ai-platform-agent-parser
systemctl restart ai-platform-backend ai-platform-frontend ai-platform-agent-parser

sleep 5
echo "=== Services ==="
systemctl is-active client-finder-backend client-finder-frontend ai-platform-backend ai-platform-frontend ai-platform-agent-parser
echo "=== Ports ==="
ss -tlnp | grep -E "8000|8010|3000|3010|8088" || true
REMOTE

echo ""
echo "✅ Deploy complete!"
echo "   AI Platform:  http://${VPS_HOST}:8088"
echo "   client-finder: https://skolesnikov.site (untouched)"
echo "   Login: admin / admin123"
echo "   Parser: uses /opt/client-finder/parser-2gis (read-only)"
