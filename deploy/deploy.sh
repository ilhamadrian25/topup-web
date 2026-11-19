#!/usr/bin/env bash
# Deploy satu image topup-web di VPS. Dipanggil GitHub Actions lewat SSH, bisa juga manual:
#   cd /opt/topupin && ./deploy.sh ghcr.io/ilhamadrian25/topup-web:<sha>
#
# Alur: pull → db up → prisma migrate deploy → app up → tunggu healthy.
# Gagal sehat → app dikembalikan ke image sebelumnya (.last_image). Migrasi tidak di-rollback
# (selalu tulis migrasi yang aditif / kompatibel mundur).
set -euo pipefail

cd "$(dirname "$0")"
NEW_IMAGE="${1:?pakai: ./deploy.sh <image:tag>}"
PREV_IMAGE="$(cat .last_image 2>/dev/null || true)"
[[ -f .env ]] || { echo "!! /opt/topupin/.env belum ada (salin dari .env.example)"; exit 1; }

compose() { IMAGE="$1" docker compose "${@:2}"; }

wait_healthy() {
  local cid status
  cid="$(compose "$1" ps -q app)"
  for _ in $(seq 1 30); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    [[ "$status" == healthy ]] && return 0
    [[ "$status" == unhealthy ]] && return 1
    sleep 3
  done
  return 1
}

echo "==> pull $NEW_IMAGE"
compose "$NEW_IMAGE" pull app
compose "$NEW_IMAGE" up -d db

echo "==> prisma migrate deploy"
compose "$NEW_IMAGE" --profile tools run --rm migrate

echo "==> start app"
compose "$NEW_IMAGE" up -d app

if wait_healthy "$NEW_IMAGE"; then
  echo "$NEW_IMAGE" > .last_image
  docker image prune -f >/dev/null || true
  echo "==> OK: $NEW_IMAGE healthy"
  exit 0
fi

echo "!! $NEW_IMAGE tidak sehat — log terakhir:"
compose "$NEW_IMAGE" logs --tail 80 app || true
if [[ -n "$PREV_IMAGE" ]]; then
  echo "==> rollback ke $PREV_IMAGE"
  compose "$PREV_IMAGE" up -d app
  wait_healthy "$PREV_IMAGE" && echo "==> rollback sehat" || echo "!! rollback juga tidak sehat"
fi
exit 1
