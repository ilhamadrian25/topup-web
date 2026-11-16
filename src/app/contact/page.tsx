import { InfoPage } from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";

export const metadata = {
  title: "Kontak",
  description: "Hubungi layanan pelanggan kami: email, telepon, WhatsApp, dan alamat usaha.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const s = await getSettings();
  const owner = s.businessName || s.storeName;
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (s.contactEmail) rows.push({ label: "Email", value: <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> });
  if (s.contactPhone)
    rows.push({ label: "Telepon", value: <a href={`tel:${s.contactPhone.replace(/[^\d+]/g, "")}`}>{s.contactPhone}</a> });
  if (s.whatsappCs) rows.push({ label: "WhatsApp", value: <a href={`https://wa.me/${s.whatsappCs}`}>+{s.whatsappCs}</a> });
  if (s.businessAddress) rows.push({ label: "Alamat usaha", value: <span className="whitespace-pre-line">{s.businessAddress}</span> });

  return (
    <InfoPage title="Hubungi Kami" intro="Ada kendala pesanan atau pertanyaan? Tim kami siap membantu." current="/contact">
      <h2>{owner}</h2>
      {rows.length ? (
        <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="font-semibold text-muted">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted">Informasi kontak belum diatur.</p>
      )}
      <h2>Jam layanan</h2>
      <p>
        Transaksi diproses otomatis 24 jam. Layanan pelanggan aktif setiap hari pukul 09.00–21.00 WIB; pesan di luar jam
        tersebut dibalas pada jam layanan berikutnya.
      </p>
      <h2>Saat menghubungi kami</h2>
      <p>
        Sertakan <b>nomor invoice</b> dan penjelasan singkat kendala agar kami bisa membantu lebih cepat. Kami tidak pernah
        meminta password atau kode OTP akun kamu.
      </p>
    </InfoPage>
  );
}
