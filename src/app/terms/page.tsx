import Link from "next/link";
import { ContactLine, InfoPage } from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";

export const metadata = {
  title: "Syarat & Ketentuan",
  description: "Syarat dan ketentuan penggunaan layanan top up game dan voucher.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const s = await getSettings();
  const owner = s.businessName || s.storeName;
  return (
    <InfoPage title="Syarat & Ketentuan" updated="16 November 2026" current="/terms">
      <p>
        Dengan mengakses situs dan melakukan pembelian di <b>{s.storeName}</b> (dikelola oleh <b>{owner}</b>, selanjutnya
        &quot;kami&quot;), kamu dianggap telah membaca, memahami, dan menyetujui syarat &amp; ketentuan berikut.
      </p>

      <h2>1. Layanan</h2>
      <p>
        {s.storeName} menjual produk digital berupa top up item/mata uang dalam game, voucher game, dan produk digital
        sejenis. Produk dikirim secara otomatis ke akun/ID tujuan yang kamu masukkan setelah pembayaran terkonfirmasi.
        Kami bukan afiliasi resmi dari penerbit game; seluruh merek dagang adalah milik pemiliknya masing-masing.
      </p>

      <h2>2. Data pesanan</h2>
      <ul>
        <li>Kamu bertanggung jawab penuh atas kebenaran data yang dimasukkan (User ID, Server/Zone ID, nominal, nomor WhatsApp, email).</li>
        <li>Gunakan fitur Cek Akun (jika tersedia) untuk memastikan nickname tujuan benar sebelum membayar.</li>
        <li>Pesanan yang sudah berhasil dikirim ke ID yang salah karena kesalahan input pembeli tidak dapat dibatalkan atau dikembalikan.</li>
        <li>Kami tidak pernah meminta password, kode OTP, atau akses login akun game kamu.</li>
      </ul>

      <h2>3. Harga &amp; pembayaran</h2>
      <ul>
        <li>Seluruh harga dalam Rupiah (IDR) dan dapat berubah sewaktu-waktu tanpa pemberitahuan. Harga yang berlaku adalah harga saat invoice dibuat.</li>
        <li>Pembayaran diproses melalui mitra payment gateway berlisensi (QRIS, e-wallet, virtual account, dan gerai retail). Biaya layanan metode pembayaran, jika ada, ditampilkan sebelum kamu membayar.</li>
        <li>Setiap invoice memiliki batas waktu pembayaran. Invoice yang melewati batas waktu otomatis kedaluwarsa; jangan membayar invoice yang sudah kedaluwarsa.</li>
        <li>Bayar sesuai nominal yang tertera pada invoice. Kelebihan/kekurangan bayar dapat menghambat proses pesanan.</li>
      </ul>

      <h2>4. Proses &amp; pengiriman</h2>
      <p>
        Pesanan diproses otomatis 24 jam setelah pembayaran terkonfirmasi, umumnya dalam hitungan detik hingga beberapa
        menit. Pada kondisi tertentu (gangguan server game, pemeliharaan supplier, atau antrean tinggi) proses dapat
        memakan waktu lebih lama. Status pesanan dapat dipantau di halaman invoice atau{" "}
        <Link href="/cek-transaksi">Cek Transaksi</Link>.
      </p>

      <h2>5. Pembatalan &amp; refund</h2>
      <p>
        Pesanan yang sudah dibayar tidak dapat dibatalkan oleh pembeli. Pengembalian dana hanya berlaku untuk kondisi
        yang dijelaskan dalam <Link href="/refund-policy">Kebijakan Refund</Link>.
      </p>

      <h2>6. Akun member</h2>
      <ul>
        <li>Kamu wajib menjaga kerahasiaan password akun member dan bertanggung jawab atas seluruh aktivitas di akun tersebut.</li>
        <li>Harga atau diskon khusus member hanya berlaku untuk transaksi saat login.</li>
        <li>Kami berhak menangguhkan akun yang terindikasi penipuan, penyalahgunaan promo, atau aktivitas melanggar hukum.</li>
      </ul>

      <h2>7. Larangan</h2>
      <p>
        Dilarang menggunakan layanan kami untuk pencucian uang, penipuan, penggunaan instrumen pembayaran milik orang
        lain tanpa izin, atau kegiatan yang melanggar hukum Republik Indonesia. Transaksi yang mencurigakan dapat kami
        tahan dan laporkan kepada pihak berwenang.
      </p>

      <h2>8. Privasi</h2>
      <p>
        Data yang kamu berikan (ID game, nomor WhatsApp, email) hanya digunakan untuk memproses pesanan, mengirim bukti
        transaksi, dan layanan pelanggan. Kami tidak menjual data pribadi kepada pihak ketiga. Data pembayaran diproses
        langsung oleh payment gateway dan tidak disimpan di server kami.
      </p>

      <h2>9. Batasan tanggung jawab</h2>
      <p>
        Kami tidak bertanggung jawab atas kerugian akibat kesalahan input pembeli, kebijakan atau sanksi dari penerbit
        game terhadap akun pembeli, maupun gangguan di luar kendali kami (force majeure). Tanggung jawab kami terbatas
        maksimal sebesar nilai transaksi yang bersangkutan.
      </p>

      <h2>10. Perubahan ketentuan</h2>
      <p>
        Kami dapat memperbarui syarat &amp; ketentuan ini sewaktu-waktu. Versi terbaru selalu tersedia di halaman ini dan
        berlaku sejak dipublikasikan.
      </p>

      <h2>11. Hubungi kami</h2>
      <p>
        Pertanyaan terkait syarat &amp; ketentuan dapat disampaikan melalui{" "}
        <ContactLine email={s.contactEmail} phone={s.contactPhone} whatsapp={s.whatsappCs} />.
      </p>
    </InfoPage>
  );
}
