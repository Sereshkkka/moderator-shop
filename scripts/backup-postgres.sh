#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/modshop-$timestamp.sql.gz"

docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-modshop}" \
  -d "${POSTGRES_DB:-modshop}" \
  --no-owner --no-privileges | gzip > "$file"

find "$BACKUP_DIR" -type f -name 'modshop-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Backup created: $file"
