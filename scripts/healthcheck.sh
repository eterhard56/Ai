#!/bin/bash
# Health check script for all AI Platform services

set -euo pipefail

echo "=== AI Platform Health Check ==="
echo ""

services=(
    "Backend|http://localhost:8000/health"
    "Frontend|http://localhost:3000"
    "Ollama|http://localhost:11434/api/tags"
    "Direct Agent|http://localhost:8001/health"
    "SEO Agent|http://localhost:8002/health"
    "Analytics Agent|http://localhost:8003/health"
    "CRM Agent|http://localhost:8004/health"
    "Parser Agent|http://localhost:8005/health"
    "Telegram Agent|http://localhost:8006/health"
    "Nginx|http://localhost/health"
)

failed=0

for service in "${services[@]}"; do
    name="${service%%|*}"
    url="${service##*|}"
    if curl -sf "$url" > /dev/null 2>&1; then
        echo "✅ $name"
    else
        echo "❌ $name ($url)"
        failed=$((failed + 1))
    fi
done

echo ""
echo "=== Docker Containers ==="
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || echo "Docker compose not running"

echo ""
if [ $failed -eq 0 ]; then
    echo "All services healthy!"
    exit 0
else
    echo "$failed service(s) failed"
    exit 1
fi
