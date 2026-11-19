#!/usr/bin/env bash
# Deploy one topup-web image. Called by GitHub Actions over SSH, or by hand:
#   cd <DEPLOY_DIR> && ./deploy.sh ghcr.io/<owner>/topup-web:<sha>
#
# Flow: pull → db up → prisma migrate deploy → app up → wait for healthy.
# Unhealthy → the app is put back on the previous image (.last_image). Migrations are
# not rolled back, so keep them additive / backward compatible.
set -euo pipefail

cd "$(dirname "$0")"
NEW_IMAGE="${1:?usage: ./deploy.sh <image:tag>}"
PREV_IMAGE="$(cat .last_image 2>/dev/null || true)"
[[ -f .env ]] || { echo "!! $(pwd)/.env is missing (copy .env.example and fill it in)"; exit 1; }

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

echo "!! $NEW_IMAGE is not healthy — last logs:"
compose "$NEW_IMAGE" logs --tail 80 app || true
if [[ -n "$PREV_IMAGE" ]]; then
  echo "==> rolling back to $PREV_IMAGE"
  compose "$PREV_IMAGE" up -d app
  wait_healthy "$PREV_IMAGE" && echo "==> rollback healthy" || echo "!! rollback is not healthy either"
fi
exit 1
