#!/usr/bin/env bash
# Sekali jalan saat cutover: salin seluruh data produksi dari Supabase ke Postgres stack topupin.
#   cd /opt/topupin && SUPABASE_DB_URL='postgresql://...:5432/postgres' ./migrate-from-supabase.sh
# Pakai koneksi DIRECT (port 5432), bukan pooler 6543.
#
# Jalankan SETELAH deploy pertama (tabel sudah dibuat oleh prisma migrate) dan SEBELUM DNS dipindah.
# Data di DB lokal (kalau ada) DITIMPA. Supabase hanya dibaca.
set -euo pipefail

cd "$(dirname "$0")"
SRC="${SUPABASE_DB_URL:?isi SUPABASE_DB_URL (Supabase direct :5432)}"
COUNT_SQL="select 'orders=' || (select count(*) from \"Order\") || ' users=' || (select count(*) from \"User\") || ' products=' || (select count(*) from \"Product\")"
TRUNCATE_SQL="do \$\$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations' loop
    execute format('truncate table public.%I cascade', r.tablename);
  end loop;
end \$\$;"

echo "==> jumlah baris di Supabase:"
docker compose exec -T db psql "$SRC" -Atc "$COUNT_SQL"

read -r -p "Timpa DB lokal topupin dengan data ini? ketik 'ya': " ok
[[ "$ok" == ya ]] || { echo "batal"; exit 1; }

echo "==> stop app (hindari tulis saat restore)"
docker compose stop app

echo "==> dump schema public (data saja) → restore"
docker compose exec -T db psql -U topup -d topup -v ON_ERROR_STOP=1 -c "$TRUNCATE_SQL"
docker compose exec -T db pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
    --exclude-table=public._prisma_migrations --disable-triggers \
  | docker compose exec -T db psql -U topup -d topup -v ON_ERROR_STOP=1 -q

echo "==> jumlah baris di lokal:"
docker compose exec -T db psql -U topup -d topup -Atc "$COUNT_SQL"

docker compose start app
echo "==> selesai. Cek admin, lalu pindahkan DNS."
