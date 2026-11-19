#!/usr/bin/env bash
# Daily backup of the database and the uploads volume. Cron (root):
#   15 3 * * * <DEPLOY_DIR>/backup.sh >> /var/log/topup-web-backup.log 2>&1
# Restore the database:
#   gunzip -c db-XXXX.sql.gz | docker compose -f <DEPLOY_DIR>/docker-compose.yml exec -T db psql -U topup -d topup
set -euo pipefail

cd "$(dirname "$0")"
DEST="${BACKUP_DIR:-/var/backups/topup-web}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U topup -d topup --clean --if-exists --no-owner | gzip > "$DEST/db-$TS.sql.gz"
docker run --rm --volumes-from "$(docker compose ps -q app)":ro -v "$DEST":/b alpine   tar czf "/b/uploads-$TS.tar.gz" -C /app/uploads .

find "$DEST" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $DEST/db-$TS.sql.gz"
