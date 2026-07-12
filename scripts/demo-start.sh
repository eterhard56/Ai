#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"

echo "=== AI Platform Demo Start ==="

# PostgreSQL setup
sudo service postgresql start 2>/dev/null || true
sudo service redis-server start 2>/dev/null || true

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='ai_platform'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ai_platform WITH PASSWORD 'demo123';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ai_platform'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ai_platform OWNER ai_platform;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_platform TO ai_platform;" 2>/dev/null || true

# Backend env
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=ai_platform
export POSTGRES_USER=ai_platform
export POSTGRES_PASSWORD=demo123
export REDIS_HOST=localhost
export REDIS_PORT=6379
export OLLAMA_HOST=http://127.0.0.1:11434
export OLLAMA_MODEL=qwen3:8b
export SECRET_KEY=demo-secret-key
export JWT_SECRET_KEY=demo-jwt-secret
export LOG_DIR=/workspace/logs/backend
export PLUGINS_DIR=/workspace/config/plugins

# Install backend deps if needed
pip3 install -q -r backend/requirements.txt 2>/dev/null || true

# Start backend
cd backend
pkill -f "uvicorn app.main:app" 2>/dev/null || true
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
echo "Backend starting on :8000"
cd ..

# Start frontend
cd frontend
export NEXT_PUBLIC_API_URL=/api/v1
pkill -f "next dev" 2>/dev/null || true
nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
echo "Frontend starting on :3000"
cd ..

sleep 5

# Health check
if curl -sf http://127.0.0.1:8000/health > /dev/null; then
  echo "✅ Backend OK"
else
  echo "⚠️ Backend starting... check /tmp/backend.log"
fi

if curl -sf http://127.0.0.1:3000 > /dev/null; then
  echo "✅ Frontend OK"
else
  echo "⚠️ Frontend starting... check /tmp/frontend.log"
fi

echo ""
echo "Локально: http://127.0.0.1:3000"
echo "Логин: admin / admin123"
