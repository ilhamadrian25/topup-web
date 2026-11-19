#!/usr/bin/env bash
# One-off cutover from a Vercel + Supabase install: copy every row from Supabase into
# this stack's Postgres. Supabase is only read.
#   cd <DEPLOY_DIR> && SUPABASE_DB_URL='postgresql://…:5432/postgres' ./migrate-from-supabase.sh
# Use the DIRECT connection (port 5432), not the 6543 pooler. Run it AFTER the first deploy
# (tables exist via prisma migrate) and BEFORE moving DNS. Local rows are OVERWRITTEN.
# CONFIRM=yes skips the prompt.
set -euo pipefail

cd "$(dirname "$0")"
SRC="${SUPABASE_DB_URL:?set SUPABASE_DB_URL (Supabase direct :5432)}"
COUNT_SQL="select 'orders=' || (select count(*) from \"Order\") || ' users=' || (select count(*) from \"User\") || ' products=' || (select count(*) from \"Product\")"
TRUNCATE_SQL="do \$\$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations' loop
    execute format('truncate table public.%I cascade', r.tablename);
  end loop;
end \$\$;"

echo "==> rows in Supabase:"
docker compose exec -T db psql "$SRC" -Atc "$COUNT_SQL"

ok="${CONFIRM:-}"
[[ -n "$ok" ]] || read -r -p "Overwrite the local database with this data? type 'yes': " ok
[[ "$ok" == yes ]] || { echo "aborted"; exit 1; }

echo "==> stopping app (no writes during restore)"
docker compose stop app

echo "==> copying public schema data"
docker compose exec -T db psql -U topup -d topup -v ON_ERROR_STOP=1 -c "$TRUNCATE_SQL"
docker compose exec -T db pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
    --exclude-table=public._prisma_migrations --disable-triggers \
  | docker compose exec -T db psql -U topup -d topup -v ON_ERROR_STOP=1 -q

echo "==> rows locally:"
docker compose exec -T db psql -U topup -d topup -Atc "$COUNT_SQL"

docker compose start app
echo "==> done. Check the admin panel, then move DNS."
