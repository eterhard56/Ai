#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
FILENAME="ai_platform_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL backup..."

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "${POSTGRES_USER:-ai_platform}" \
    -d "${POSTGRES_DB:-ai_platform}" \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup saved: ${FILENAME}"

# Cleanup old backups
RETENTION=${BACKUP_RETENTION_DAYS:-30}
find "${BACKUP_DIR}" -name "ai_platform_*.sql.gz" -mtime +${RETENTION} -delete
echo "[$(date)] Cleaned backups older than ${RETENTION} days"
