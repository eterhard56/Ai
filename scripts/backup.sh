#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/ai-platform/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="ai_platform_${TIMESTAMP}.sql.gz"

source /opt/ai-platform/.env 2>/dev/null || true

echo "[$(date)] Starting backup..."

docker exec ai-platform-postgres pg_dump \
    -U "${POSTGRES_USER:-ai_platform}" \
    -d "${POSTGRES_DB:-ai_platform}" \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup saved: ${BACKUP_DIR}/${FILENAME}"

find "${BACKUP_DIR}" -name "ai_platform_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned backups older than ${RETENTION_DAYS} days"
