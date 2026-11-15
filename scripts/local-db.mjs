// Postgres lokal tanpa Docker (binary dari paket embedded-postgres).
// Data disimpan di .pgdata/. Jalankan: npm run db:local  (biarkan terminal terbuka)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(".pgdata");
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "topup",
  password: "topup",
  port: 5433,
  persistent: true,
});

if (!existsSync(resolve(dir, "PG_VERSION"))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("topup");
} catch {
  // sudah ada
}
console.log("Postgres siap di postgresql://topup:topup@localhost:5433/topup (Ctrl+C untuk berhenti)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
