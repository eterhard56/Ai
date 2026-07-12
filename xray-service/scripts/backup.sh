#!/bin/bash
set -euo pipefail
BASE="/opt/xray-service"
STAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BASE/backup/backup_${STAMP}"
mkdir -p "$DEST"
cp -a "$BASE/docker-compose.yml" "$BASE/.env" "$DEST/" 2>/dev/null || true
[ -d "$BASE/configs" ] && cp -a "$BASE/configs" "$DEST/"
[ -d "$BASE/data/db" ] && tar -czf "$DEST/db.tar.gz" -C "$BASE/data" db
docker compose -f "$BASE/docker-compose.yml" config > "$DEST/compose-resolved.yml" 2>/dev/null || true
ls -1dt "$BASE/backup"/backup_* 2>/dev/null | tail -n +15 | xargs -r rm -rf
echo "Backup: $DEST"
