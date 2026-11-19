# Self-hosting topup-web

Runs the store on any Linux server with Docker: the app and a bundled Postgres 17 in one Compose
project, behind a reverse proxy you already have (nginx, Caddy, Traefik, …). A fixed server IP also
lets you use payment gateways that whitelist API callers by IP (iPaymu production does).

```
browser → your reverse proxy (TLS) → APP_BIND (default 127.0.0.1:3000) → app → db
                                                                            └─► payment gateway / biller (from this server's IP)
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | `app`, `db`, one-shot `migrate`; volumes `pgdata`, `uploads` |
| `deploy.sh <image>` | pull → `prisma migrate deploy` → start → wait healthy, roll back to the previous image if not |
| `backup.sh` | daily `pg_dump` + uploads tarball, 14-day retention |
| `migrate-from-supabase.sh` | one-off copy from a Vercel + Supabase install |
| `nginx.example.conf` | reverse-proxy example |
| `../.github/workflows/deploy.yml` | push to `main` → image on GHCR → SSH → `deploy.sh` |

## 1. Server

```bash
DEPLOY_DIR=/opt/topup-web
sudo mkdir -p "$DEPLOY_DIR" && cd "$DEPLOY_DIR"
# copy deploy/.env.example here as .env and fill it in (the workflow also copies it on every deploy)
sudo chmod 600 .env
```

- `IMAGE`: `ghcr.io/<your-github-user>/topup-web:latest`. If the GHCR package is private, run
  `docker login ghcr.io` once on the server (the workflow logs in for its own deploys).
- `POSTGRES_PASSWORD`, `AUTH_SECRET`: generate them. **Moving an existing install?** Keep `AUTH_SECRET`
  and `CONFIG_ENCRYPTION_KEY` from it: payment gateway credentials in the DB are encrypted with them.
- `APP_BIND`: where your reverse proxy reaches the app. Keep `127.0.0.1:3000` for a proxy on the host;
  a proxy in another Docker container on the same host can use the docker0 address (`172.17.0.1:3000`).
  Never bind it to a public interface.

## 2. Reverse proxy

Point your domain at the app; `nginx.example.conf` shows the headers the app expects
(`X-Forwarded-Proto`, `X-Forwarded-Host`) and the 5 MB body limit for admin image uploads.

## 3. CI/CD (GitHub Actions)

Repository settings → Secrets and variables → Actions:

- Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (a key whose public half is in that user's
  `authorized_keys`; the user must be able to run `docker`), optional `VPS_KNOWN_HOSTS`.
- Variables: `VPS_DEPLOY=true`, optional `DEPLOY_DIR` (default `/opt/topup-web`).

Every push to `main` then builds `ghcr.io/<owner>/topup-web:<sha>` and deploys it. Without `VPS_DEPLOY`
the workflow only builds and pushes. A manual deploy is `./deploy.sh ghcr.io/<owner>/topup-web:<sha>`.

The first deploy starts with an empty database (all migrations applied). Create the first admin by
running the seed once against it, or migrate an existing install (next step).

## 4. Moving from Vercel + Supabase (optional)

```bash
cd "$DEPLOY_DIR" && SUPABASE_DB_URL='postgresql://…@….supabase.com:5432/postgres' ./migrate-from-supabase.sh
```

Supabase is only read. Images already uploaded to Supabase Storage keep working while that project exists;
new uploads go to the `uploads` volume when `SUPABASE_*` are empty. Re-run it right before switching DNS
if orders came in meanwhile, then disconnect the Vercel project's Git integration.

## 5. Backups

```bash
echo "15 3 * * * root $DEPLOY_DIR/backup.sh >> /var/log/topup-web-backup.log 2>&1" | sudo tee /etc/cron.d/topup-web-backup
```

## Operations (in `$DEPLOY_DIR`)

| Task | Command |
|---|---|
| Status / logs | `docker compose ps` · `docker compose logs -f --tail 100 app` |
| Roll back | `./deploy.sh <previous image>` (`.last_image` holds the current one) |
| psql | `docker compose exec db psql -U topup -d topup` |
