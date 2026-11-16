import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { jsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export const metadata = {
  title: "FAQ — Pertanyaan Umum",
  description: "Jawaban atas pertanyaan yang sering diajukan seputar top up game, pembayaran, dan refund.",
  alternates: { canonical: "/faq" },
};

function faqs(store: string) {
  return [
    {
      q: `Bagaimana cara top up di ${store}?`,
      a: "Pilih game, masukkan User ID (dan Server/Zone ID bila diminta), pilih nominal dan metode pembayaran, lalu klik Pesan Sekarang. Selesaikan pembayaran sesuai instruksi di halaman invoice — item otomatis masuk ke akun setelah pembayaran diterima.",
    },
    {
      q: "Berapa lama pesanan diproses?",
      a: "Pesanan diproses otomatis 24 jam begitu pembayaran terkonfirmasi, biasanya dalam hitungan detik. Saat server game sedang gangguan atau pemeliharaan, proses bisa lebih lama.",
    },
    {
      q: "Metode pembayaran apa saja yang tersedia?",
      a: "QRIS, e-wallet (DANA, OVO, ShopeePay), virtual account bank (BCA, BRI, Mandiri, dll.), dan gerai retail (Alfamart). Metode yang aktif ditampilkan di halaman pemesanan.",
    },
    {
      q: "Apakah harus daftar akun?",
      a: "Tidak. Kamu bisa membeli tanpa akun. Mendaftar sebagai member memberi harga member yang lebih murah dan riwayat transaksi.",
    },
    {
      q: "Apakah aman? Apakah kalian meminta password akun game?",
      a: "Aman. Kami hanya membutuhkan User ID/Server ID dan nomor WhatsApp untuk bukti transaksi. Kami tidak pernah meminta password atau kode OTP akun game kamu.",
    },
    {
      q: "Bagaimana cara cek status pesanan?",
      a: "Buka halaman invoice dari link bukti transaksi, atau masukkan nomor invoice di menu Cek Transaksi.",
    },
    {
      q: "Saya salah memasukkan User ID, bisa dibatalkan?",
      a: "Jika pesanan sudah berhasil dikirim ke ID yang dimasukkan, pesanan tidak dapat dibatalkan atau dikembalikan. Selalu gunakan fitur Cek Akun untuk memastikan nickname benar sebelum membayar.",
    },
    {
      q: "Sudah bayar tapi pesanan gagal, bagaimana?",
      a: "Simpan nomor invoice kamu. Pesanan gagal akan kami proses ulang atau dananya dikembalikan sesuai Kebijakan Refund. Hubungi kami melalui halaman Kontak bila status tidak berubah.",
    },
    {
      q: "Invoice saya kedaluwarsa, apa yang harus dilakukan?",
      a: "Jangan membayar invoice yang sudah kedaluwarsa. Buat pesanan baru untuk mendapatkan kode pembayaran yang baru.",
    },
  ];
}

export default async function Faq() {
  const s = await getSettings();
  const list = faqs(s.storeName);
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <InfoPage title="Pertanyaan Umum (FAQ)" intro="Belum menemukan jawabannya? Hubungi kami." current="/faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <div className="-my-2 divide-y divide-line">
        {list.map((f) => (
          <details key={f.q} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              {f.q}
              <span className="text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="border-t border-line pt-4 text-muted">
        Lihat juga <Link href="/terms">Syarat &amp; Ketentuan</Link>, <Link href="/refund-policy">Kebijakan Refund</Link>,
        atau <Link href="/contact">hubungi kami</Link>.
      </p>
    </InfoPage>
  );
}
