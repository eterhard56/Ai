#!/bin/bash
set -euo pipefail

BASE="/opt/vpn-service"
cd "$BASE"

echo "=== docker compose ps ==="
docker compose ps

echo ""
echo "=== container health ==="
docker inspect --format='{{.Name}} {{.State.Health.Status}}' vpn-wg-easy 2>/dev/null || echo "container not running"

echo ""
echo "=== wg port ==="
ss -ulpn | grep 51820 || echo "UDP 51820 not listening"

echo ""
echo "=== ui via nginx ==="
curl -s -o /dev/null -w "nginx ${VPN_NGINX_PORT:-9443}: %{http_code}\n" "http://127.0.0.1:${VPN_NGINX_PORT:-9443}/" 2>/dev/null || true
