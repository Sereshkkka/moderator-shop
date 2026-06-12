#!/bin/sh
set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/data/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

lock_dir="$BACKUP_DIR/.backup.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Backup is already running."
  exit 0
fi

temp_file=""
file=""
backup_complete=false
cleanup() {
  [ -z "$temp_file" ] || rm -f "$temp_file"
  [ "$backup_complete" = true ] || [ -z "$file" ] || rm -f "$file"
  rmdir "$lock_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/modshop-$timestamp.sql.gz"
temp_file="$BACKUP_DIR/.modshop-$timestamp.sql.tmp"

docker compose exec -T postgres sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --clean --if-exists' \
  > "$temp_file"

if [ ! -s "$temp_file" ]; then
  echo "Backup failed: pg_dump produced an empty file." >&2
  exit 1
fi

gzip -c "$temp_file" > "$file"
gzip -t "$file"
chmod 600 "$file"
rm -f "$temp_file"
temp_file=""
backup_complete=true

find "$BACKUP_DIR" -type f -name 'modshop-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
size="$(du -h "$file" | cut -f1)"
echo "Backup created: $file ($size)"
