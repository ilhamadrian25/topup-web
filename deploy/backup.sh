#!/usr/bin/env bash
# Backup harian DB + uploads topupin. Pasang di cron root:
#   15 3 * * * /opt/topupin/backup.sh >> /var/log/topupin-backup.log 2>&1
# Restore DB:
#   gunzip -c db-XXXX.sql.gz | docker compose -f /opt/topupin/docker-compose.yml exec -T db psql -U topup -d topup
set -euo pipefail

cd "$(dirname "$0")"
DEST="${BACKUP_DIR:-/var/backups/topupin}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U topup -d topup --clean --if-exists --no-owner | gzip > "$DEST/db-$TS.sql.gz"
docker run --rm -v topupin_uploads:/u:ro -v "$DEST":/b alpine tar czf "/b/uploads-$TS.tar.gz" -C /u .

find "$DEST" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $DEST/db-$TS.sql.gz"
