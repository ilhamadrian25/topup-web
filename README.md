# topup-web

Website top up game & voucher (Next.js 15 full-stack, App Router). Supplier/biller
= Payterra sebagai **user merchant** — untuk sekarang di-mock sampai API merchant
dibuat di sisi Payterra (lihat [docs/payterra-merchant-api.md](docs/payterra-merchant-api.md)).

## Stack
Next.js 15 · React 19 · Tailwind v4 · Prisma 6 + PostgreSQL · JWT session (jose) · zod

## Menjalankan

```bash
cp .env.example .env        # sesuaikan AUTH_SECRET
npm install
npm run db:local            # Postgres lokal TANPA Docker (port 5433, data di .pgdata/) — biarkan terminal ini terbuka
                            # (alternatif bila ada Docker: npm run db:up)
npm run db:migrate          # buat tabel
npm run db:seed             # kategori, 9 game, metode bayar, banner, admin, sync produk mock
npm run dev
```

Admin default: `admin@topup.local` / `admin12345` (ubah lewat `SEED_ADMIN_*`).

## Fitur
- **Storefront**: beranda (banner, populer, kategori, pencarian), halaman game
  (input akun → cek nickname → nominal → pembayaran → kontak), invoice dengan
  QRIS/VA/kode bayar + countdown + status realtime (polling), cek transaksi.
- **Member**: daftar/masuk, harga member, riwayat transaksi.
- **Admin** (`/admin`): dashboard omzet/laba/saldo biller, transaksi (filter,
  detail, kirim ulang, refund manual, tandai lunas), game & produk (harga jual,
  harga member, margin massal), metode pembayaran & fee, banner, user/role,
  pengaturan & sync produk dari biller.

## Alur order
```
createOrder ─► payment.createCharge ─► UNPAID
webhook/mock ─► markOrderPaid (idempoten) ─► fulfillOrder ─► biller.purchase(refId = INVOICE-attempt)
   PENDING ─► polling checkStatus saat invoice dibuka / callback /api/biller/callback ─► SUCCESS | FAILED
FAILED ─► admin: kirim ulang (refId baru) atau tandai refund
```

## Mock
- **Biller** (`src/lib/biller/mock.ts`): ID < 5 digit atau berakhiran `999` →
  akun tidak ditemukan; berakhiran `000` → transaksi gagal; selain itu sukses ~8 detik.
- **Pembayaran** (`src/lib/payment`): gateway `mock` (seed) menampilkan tombol
  "Simulasikan pembayaran berhasil" di invoice (hanya di development, atau `ALLOW_MOCK_PAYMENT=true`).

## Payment gateway (multi-gateway, diatur dari DB)

Gateway tidak dikonfigurasi lewat env. Semua ada di tabel `PaymentGateway` dan dikelola di
**Admin → Payment Gateway**; API key disimpan terenkripsi (AES-256-GCM, kunci `CONFIG_ENCRYPTION_KEY`
atau `AUTH_SECRET`). Tiap `PaymentMethod` memilih gateway + `gatewayMethod`/`gatewayChannel`, jadi
beberapa gateway bisa aktif sekaligus. Provider yang didukung: **iPaymu** (plus `MOCK` untuk dev).

Pakai iPaymu sandbox:
1. Admin → Payment Gateway → "iPaymu Sandbox": isi VA + API key dari https://sandbox.ipaymu.com/dashboard,
   centang Aktif, Simpan, lalu **Tes koneksi** (cek saldo).
2. Salin URL callback (`{APP_URL}/api/payments/callback/{kode}`) ke dashboard iPaymu sebagai notify URL.
   Untuk localhost pakai tunnel (ngrok/cloudflared) dan set `APP_URL` ke URL tunnel — tanpa itu status
   tetap ter-update lewat polling saat invoice dibuka.
3. Klik **Pakai untuk semua metode** atau pilih gateway per metode di Admin → Metode Bayar.

Pemetaan iPaymu: VA → `va` + bank (`bca`, `bri`, `mandiri`, ...), QRIS → `qris` + `mpm`, Alfamart → `cstore` + `alfamart`,
e-wallet → `redirect` (halaman bayar iPaymu). Callback tidak dipercaya mentah-mentah: status dan nominal
selalu dicek ulang ke `POST /api/v2/transaction` dan `ReferenceId` harus sama dengan invoice.

Menambah provider baru: tambah nilai enum `GatewayProvider`, adapter di `src/lib/payment/`, dan entri di
`PROVIDERS` + `gatewayAdapter()` (`src/lib/payment/index.ts`).

## Ganti ke Payterra
Setelah API merchant tersedia: `BILLER_PROVIDER=payterra` + `PAYTERRA_*` di `.env`,
sesuaikan `src/lib/biller/payterra.ts` dengan kontrak final, lalu Sync Produk di admin.
