#!/bin/bash
set -euo pipefail

BASE="/opt/vpn-service"
STAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BASE/backups/backup_${STAMP}"
mkdir -p "$DEST"

cp -a "$BASE/docker-compose.yml" "$DEST/"
cp -a "$BASE/.env" "$DEST/.env"
[ -d "$BASE/configs" ] && cp -a "$BASE/configs" "$DEST/"
[ -d "$BASE/data" ] && tar -czf "$DEST/data.tar.gz" -C "$BASE" data

docker compose -f "$BASE/docker-compose.yml" config > "$DEST/compose-resolved.yml" 2>/dev/null || true

# Keep last 14 backups
ls -1dt "$BASE/backups"/backup_* 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "Backup saved: $DEST"
