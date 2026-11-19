# Deploy topupin ke VPS

Stack sendiri di `/opt/topupin` (Docker Compose project `topupin`: `app` + `db` Postgres 17),
terpisah dari stack payterra. Satu-satunya titik sentuh: nginx payterra (pemilik port 80/443)
meneruskan `topupin.xyz` ke `172.17.0.1:3310`.

```
Cloudflare (proxied) → nginx payterra :443 ──host.docker.internal:3310──► topupin-app ──► topupin-db
                                                                         └─► iPaymu (keluar dari IP VPS → whitelist IP ini)
```

CI/CD: `.github/workflows/deploy.yml` — push ke `main` → build image → `ghcr.io/ilhamadrian25/topup-web:<sha>`
→ SSH → `deploy.sh` (pull → `prisma migrate deploy` → up → health check, rollback otomatis kalau tidak sehat).

## Setup sekali (di VPS, sebagai root)

1. **Folder & env**
   ```bash
   mkdir -p /opt/topupin && cd /opt/topupin
   # salin deploy/.env.example dari repo → .env, lalu isi
   chmod 600 .env
   ```
   `AUTH_SECRET` dan `CONFIG_ENCRYPTION_KEY` **harus sama** dengan produksi lama (Vercel) —
   kredensial iPaymu di DB terenkripsi dengan kunci itu.

2. **User deploy untuk GitHub Actions** (boleh pakai user yang sudah ada asal bisa `docker`):
   ```bash
   useradd -m -s /bin/bash -G docker topupin-deploy
   chown -R topupin-deploy: /opt/topupin
   ssh-keygen -t ed25519 -N '' -f /tmp/topupin_gha     # private → secret VPS_SSH_KEY
   install -d -m 700 -o topupin-deploy /home/topupin-deploy/.ssh
   cat /tmp/topupin_gha.pub >> /home/topupin-deploy/.ssh/authorized_keys
   chown topupin-deploy: /home/topupin-deploy/.ssh/authorized_keys && chmod 600 /home/topupin-deploy/.ssh/authorized_keys
   ```

3. **GitHub** (repo topup-web → Settings):
   - Secrets: `VPS_HOST=46.250.238.18`, `VPS_USER=topupin-deploy`, `VPS_SSH_KEY=<isi /tmp/topupin_gha>`,
     opsional `VPS_KNOWN_HOSTS=<ssh-keyscan 46.250.238.18>`. Lalu hapus `/tmp/topupin_gha*` di server.
   - Variables: `VPS_DEPLOY=true`.
   - Jalankan workflow **deploy** (Actions → deploy → Run workflow) → stack naik dengan DB kosong + migrasi.

4. **Nginx payterra** — vhost + origin cert topupin.xyz:
   - Cloudflare → topupin.xyz → SSL/TLS → Origin Server → Create certificate (`topupin.xyz`, `*.topupin.xyz`)
     → simpan sebagai `payterra-setup/nginx/ssl/topupin.crt` & `topupin.key` di server.
   - Salin `deploy/nginx/topupin.conf` ke `payterra-setup/nginx/conf.d/topupin.conf`.
   - `docker exec nginx nginx -t && docker exec nginx nginx -s reload`
   - Tes sebelum DNS pindah: `curl -sk --resolve www.topupin.xyz:443:46.250.238.18 https://www.topupin.xyz/ -o /dev/null -w '%{http_code}\n'`

5. **Pindah data dari Supabase** (Supabase hanya dibaca):
   ```bash
   cd /opt/topupin && SUPABASE_DB_URL='postgresql://…@…supabase.com:5432/postgres' ./migrate-from-supabase.sh
   ```

6. **iPaymu**: daftarkan IP `46.250.238.18` di whitelist IP akun iPaymu.

7. **DNS cutover** (Cloudflare): `topupin.xyz` dan `www` → A `46.250.238.18`, **Proxied** (oranye), SSL mode **Full (strict)**.
   Lalu di Vercel: Settings → Git → Disconnect (supaya push ke main tidak deploy ke Vercel lagi).
   Kalau ada order yang dibuat di Vercel di antara langkah 5 dan 7, ulangi langkah 5 sesaat sebelum pindah DNS.

8. **Backup harian**:
   ```bash
   echo '15 3 * * * root /opt/topupin/backup.sh >> /var/log/topupin-backup.log 2>&1' > /etc/cron.d/topupin-backup
   ```

## Operasional

| Perlu | Perintah (di `/opt/topupin`) |
|---|---|
| Status | `docker compose ps` |
| Log app | `docker compose logs -f --tail 100 app` |
| Deploy ulang image tertentu | `./deploy.sh ghcr.io/ilhamadrian25/topup-web:<sha>` (package GHCR privat → `docker login ghcr.io` dulu) |
| Rollback | `./deploy.sh $(cat .last_image)` sebelum deploy rusak, atau sha commit yang bagus |
| psql | `docker compose exec db psql -U topup -d topup` |
| Seed admin awal (DB kosong saja) | jangan di produksi yang sudah berisi data |
