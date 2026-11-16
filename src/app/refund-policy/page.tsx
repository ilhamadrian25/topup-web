import Link from "next/link";
import { ContactLine, InfoPage } from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";

export const metadata = {
  title: "Kebijakan Refund",
  description: "Ketentuan pengembalian dana (refund) untuk pesanan top up game dan voucher.",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const s = await getSettings();
  return (
    <InfoPage
      title="Kebijakan Refund"
      intro="Kami ingin setiap pesanan sampai. Jika tidak, berikut cara kami mengembalikan dana kamu."
      updated="16 November 2026"
      current="/refund-policy"
    >
      <h2>Kapan refund diberikan</h2>
      <p>Dana dikembalikan 100% sesuai nominal yang dibayarkan apabila:</p>
      <ul>
        <li>Pembayaran sudah terkonfirmasi tetapi pesanan <b>gagal diproses</b> oleh sistem/supplier dan tidak dapat dikirim ulang.</li>
        <li>Produk yang dipesan <b>tidak tersedia</b> (stok habis/gangguan) setelah pembayaran diterima.</li>
        <li>Terjadi <b>pembayaran ganda</b> untuk invoice yang sama.</li>
        <li>Pembayaran masuk setelah invoice kedaluwarsa sehingga pesanan tidak diproses.</li>
      </ul>

      <h2>Kapan refund tidak diberikan</h2>
      <ul>
        <li>Pesanan sudah <b>berhasil dikirim</b> ke User ID/Server ID yang dimasukkan pembeli, termasuk bila ID tersebut salah ketik.</li>
        <li>Kode voucher sudah ditampilkan/dikirim kepada pembeli.</li>
        <li>Pembeli berubah pikiran setelah pesanan berhasil diproses.</li>
        <li>Akun game tujuan terkena sanksi/banned oleh penerbit game.</li>
      </ul>

      <h2>Cara mengajukan refund</h2>
      <ol>
        <li>Pastikan status pesanan di halaman invoice atau <Link href="/cek-transaksi">Cek Transaksi</Link> berstatus <b>Gagal</b>.</li>
        <li>
          Hubungi kami melalui <ContactLine email={s.contactEmail} phone={s.contactPhone} whatsapp={s.whatsappCs} /> dengan
          menyertakan <b>nomor invoice</b>, bukti pembayaran, serta rekening/e-wallet tujuan pengembalian atas nama pembeli.
        </li>
        <li>Tim kami memverifikasi pengajuan maksimal <b>1×24 jam</b> pada hari kerja.</li>
      </ol>

      <h2>Waktu &amp; metode pengembalian</h2>
      <ul>
        <li>Dana dikembalikan maksimal <b>3–7 hari kerja</b> setelah pengajuan disetujui.</li>
        <li>Refund dikirim ke rekening bank atau e-wallet atas nama pembeli. Untuk pembayaran tertentu, refund dapat dilakukan melalui kanal pembayaran asal sesuai ketentuan payment gateway.</li>
        <li>Nominal refund sebesar harga produk yang dibayar. Biaya admin metode pembayaran yang dikenakan pihak ketiga dapat tidak ikut dikembalikan bila tidak dapat ditarik kembali dari penyedia.</li>
        <li>Sebagai alternatif, pesanan gagal dapat kami <b>proses ulang</b> atas persetujuan pembeli.</li>
      </ul>

      <h2>Pengajuan kedaluwarsa</h2>
      <p>Pengajuan refund diterima paling lambat <b>30 hari</b> sejak tanggal transaksi.</p>
    </InfoPage>
  );
}
