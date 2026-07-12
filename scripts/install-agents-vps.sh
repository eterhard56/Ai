#!/bin/bash
# Install all AI Platform agents as systemd services on VPS
set -euo pipefail

INSTALL_DIR="/opt/ai-platform"
VENV="${INSTALL_DIR}/venv/bin"
AGENTS_DIR="${INSTALL_DIR}/agents"

install_agent() {
  local name=$1 port=$2 dir=$3 extra_env=${4:-}
  local exec_cmd="${VENV}/python3 -m uvicorn main:app --host 127.0.0.1 --port ${port}"
  if [ "$name" = "telegram" ]; then
    exec_cmd="${VENV}/python3 main.py"
  fi
  cat > "/etc/systemd/system/ai-platform-agent-${name}.service" << EOF
[Unit]
Description=AI Platform ${name} Agent
After=ai-platform-backend.service network.target

[Service]
Type=simple
WorkingDirectory=${AGENTS_DIR}/${dir}
EnvironmentFile=${INSTALL_DIR}/.env
Environment=LOG_DIR=${INSTALL_DIR}/logs/agents/${name}
Environment=POSTGRES_HOST=localhost
Environment=REDIS_HOST=localhost
Environment=OLLAMA_HOST=http://127.0.0.1:11434
Environment=BACKEND_URL=http://127.0.0.1:8010
Environment=PYTHONPATH=${AGENTS_DIR}
${extra_env}
ExecStart=${exec_cmd}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "ai-platform-agent-${name}"
  systemctl restart "ai-platform-agent-${name}"
}

# Shared deps for agents
${VENV}/pip install -q beautifulsoup4 lxml openpyxl httpx 2>/dev/null || true

install_agent "direct"    8101 "direct"    ""
install_agent "seo"       8102 "seo"       ""
install_agent "analytics" 8103 "analytics" ""
install_agent "crm"       8104 "crm"       ""
# parser already on 8105
install_agent "parser"    8105 "parser"     "Environment=PARSER_2GIS_BIN=/opt/client-finder/parser-2gis/venv/bin/parser-2gis"
install_agent "telegram"  8106 "telegram"  ""

echo "All agents installed"
