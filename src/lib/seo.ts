/** Base URL publik untuk canonical, sitemap, OG. Set APP_URL di produksi. */
export function siteUrl(path = ""): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

/** Render objek JSON-LD dengan aman (cegah </script> injection). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function gameFaq(game: { name: string; inputFields: unknown; nicknameCheck: boolean }, store: string) {
  const fields = (game.inputFields as { label: string }[]) ?? [];
  const ids = fields.map((f) => f.label).join(" dan ");
  return [
    {
      q: `Bagaimana cara top up ${game.name} di ${store}?`,
      a: fields.length
        ? `Masukkan ${ids} akun kamu${game.nicknameCheck ? ", klik Cek Akun untuk memastikan nickname benar" : ""}, pilih nominal, pilih metode pembayaran, lalu klik Pesan Sekarang dan selesaikan pembayaran. Item otomatis masuk ke akun setelah pembayaran diterima.`
        : `Pilih nominal voucher, pilih metode pembayaran, lalu klik Pesan Sekarang dan selesaikan pembayaran. Kode voucher langsung tampil di halaman invoice setelah pembayaran diterima.`,
    },
    {
      q: `Berapa lama proses top up ${game.name}?`,
      a: "Pesanan diproses otomatis 24 jam begitu pembayaran terkonfirmasi, biasanya hanya beberapa detik.",
    },
    {
      q: `Metode pembayaran apa saja yang tersedia?`,
      a: "QRIS, e-wallet (DANA, OVO, ShopeePay), virtual account bank (BCA, BRI, Mandiri), dan gerai retail (Alfamart).",
    },
    {
      q: `Apakah top up ${game.name} di ${store} aman?`,
      a: `Aman. Kami hanya membutuhkan ${fields.length ? ids : "nomor WhatsApp untuk bukti transaksi"}, tidak pernah meminta password akun. Produk diproses langsung lewat supplier resmi.`,
    },
    {
      q: "Bagaimana jika top up gagal?",
      a: "Simpan nomor invoice kamu. Pesanan yang gagal diproses akan dikirim ulang atau dananya dikembalikan oleh tim kami.",
    },
  ];
}
