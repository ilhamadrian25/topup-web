# Payterra Merchant API (usulan kontrak)

Status: **belum ada di sisi Payterra.** topup-web saat ini memakai `MockBiller`
(`BILLER_PROVIDER=mock`). Dokumen ini adalah kontrak yang diharapkan
`src/lib/biller/payterra.ts`, supaya API merchant bisa dibangun di Payterra
(kemungkinan di dk-mobile-service atau core) dan topup-web tinggal ganti env.

## Konsep

- Satu **user merchant** di Payterra = satu toko (topup-web). Saldo transaksi
  dipotong dari wallet merchant tersebut (ledger core yang sudah ada).
- Auth server-to-server: `Authorization: Bearer <api_key>` + `X-Merchant-Id`.
  Tanpa OTP/PIN/device header seperti API mobile. Disarankan whitelist IP.
- Harga merchant = harga modal untuk merchant (bisa beda dari harga user app).

## Endpoint

Semua respons: `{ "data": ... }` atau error `{ "message": "..." }` dengan status 4xx/5xx.

### `GET /v1/merchant/products`
```json
{ "data": [ { "code": "MLBB-01", "brandCode": "MLBB", "brandName": "Mobile Legends",
              "name": "5 Diamonds", "price": 1450, "available": true } ] }
```

### `GET /v1/merchant/balance`
```json
{ "data": { "balance": 5000000 } }
```

### `POST /v1/merchant/account-check`
Request `{ "brandCode": "MLBB", "account": { "userId": "12345678", "zoneId": "1234" } }`
```json
{ "data": { "ok": true, "nickname": "PlayerName" } }
{ "data": { "ok": false, "message": "Akun tidak ditemukan" } }
```
Key `account` mengikuti `inputFields` game di topup-web; Payterra yang memetakan
ke customerNumber/customerNumber2 provider (payload routing yang sudah ada).

### `POST /v1/merchant/transactions`
Request `{ "refId": "TW261114ABCD1234-1", "productCode": "MLBB-01", "account": {...} }`

**Wajib idempoten per `refId`**: request ulang dengan refId sama mengembalikan
transaksi yang sama, tidak memotong saldo dua kali.
```json
{ "data": { "status": "PENDING|SUCCESS|FAILED", "billerRef": "PTR...", "sn": "...",
            "message": "...", "price": 1450 } }
```
Saldo kurang → `FAILED` dengan message jelas (bukan 5xx), supaya order bisa di-refund/retry.

### `GET /v1/merchant/transactions/{refId}`
Respons sama dengan di atas. 404 jika refId tidak dikenal.

## Callback

Saat status final, Payterra `POST {merchant_callback_url}` (topup-web:
`/api/biller/callback`) dengan body:
```json
{ "refId": "TW261114ABCD1234-1", "status": "SUCCESS", "billerRef": "PTR...", "sn": "...", "message": "..." }
```
Header `X-Payterra-Signature` = hex HMAC-SHA256(raw body, callback secret).
Retry dengan backoff sampai 2xx. topup-web juga polling `GET .../{refId}` sebagai cadangan.
