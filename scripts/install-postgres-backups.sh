#!/bin/sh
set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup-postgres.sh"
BACKUP_DIR="$PROJECT_DIR/data/backups"
CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-15 4 * * *}"
CRON_MARKER="# modshop-postgres-backup"
CRON_LINE="$CRON_SCHEDULE cd $PROJECT_DIR && /bin/sh $BACKUP_SCRIPT >> $BACKUP_DIR/backup.log 2>&1 $CRON_MARKER"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
chmod +x "$BACKUP_SCRIPT" "$PROJECT_DIR/scripts/install-postgres-backups.sh"

echo "Creating the first verified backup..."
"$BACKUP_SCRIPT"

existing_crontab="$(crontab -l 2>/dev/null || true)"
filtered_crontab="$(printf '%s\n' "$existing_crontab" | grep -vF "$CRON_MARKER" || true)"
{
  printf '%s\n' "$filtered_crontab"
  printf '%s\n' "$CRON_LINE"
} | sed '/^[[:space:]]*$/d' | crontab -

echo "Daily PostgreSQL backup installed: $CRON_SCHEDULE (server time)."
echo "Backups: $BACKUP_DIR"
echo "Log: $BACKUP_DIR/backup.log"
