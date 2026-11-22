import { getSettings } from "@/lib/settings";
import Link from "next/link";
import { activeBiller, billerLabel } from "@/lib/biller";
import { db } from "@/lib/db";
import { categoryMarkups, pricesFor } from "@/lib/settings";
import { getLastSync } from "@/lib/product-sync";
import { saveCategoryMarginsAction, settingsAction, syncAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";
import { ImageField } from "../ImageField";

export default async function AdminSettings({ searchParams }: { searchParams: FlashSP }) {
  const [s, categories] = await Promise.all([
    getSettings(),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { games: true } } } }),
  ]);
  const [b, last] = await Promise.all([activeBiller(), getLastSync()]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Pengaturan & Sync</h1>
      <Flash sp={await searchParams} />

      <section className="card p-4">
        <h2 className="font-bold">Sync produk dari biller</h2>
        <p className="mt-1 text-sm text-muted">
          Biller aktif: <b>{billerLabel(b)}</b> (atur di{" "}
          <Link href="/admin/billers" className="text-accent hover:underline">menu Biller</Link>). Sync menarik semua produk, mencocokkan
          ke game lewat kode brand, memperbarui modal & ketersediaan, lalu menghitung ulang harga jual & member dari markup
          kategori. Sync otomatis:{" "}
          <b>{s.autoSyncMinutes > 0 ? `tiap ${s.autoSyncMinutes} menit` : "mati"}</b> (atur di bagian Toko di bawah).
        </p>
        {last && (
          <p className={`mt-2 text-sm ${last.ok ? "text-muted" : "text-danger"}`}>
            Sync terakhir ({last.source === "auto" ? "otomatis" : "manual"}){" "}
            {new Date(last.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB — {last.ok ? "" : "gagal: "}
            {last.message}
          </p>
        )}
        <form action={syncAction} className="mt-3">
          <button className="btn-primary">Sync Produk Sekarang</button>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="font-bold">Markup per kategori</h2>
        <p className="mt-1 text-sm text-muted">
          Harga jual = modal + markup % + markup tetap (Rp); harga member = modal + markup member % + markup member tetap. Dibulatkan ke
          atas ke kelipatan 100. Kolom % kosong = pakai default toko (biasa {s.defaultMarginBps / 100}%, member{" "}
          {s.defaultMemberMarginBps / 100}%). Harga member hanya berlaku bila lebih murah dari harga biasa. Saat disimpan, harga semua
          produk langsung dihitung ulang.
        </p>
        <form action={saveCategoryMarginsAction} id="category-margins" />
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Kategori</th><th>Markup % (bps)</th><th>Markup tetap (Rp)</th><th>Markup member % (bps)</th><th>Markup member tetap (Rp)</th><th>Contoh modal Rp 10.000</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const ex = pricesFor(10_000, categoryMarkups(c, s));
                return (
                  <tr key={c.id}>
                    <td>
                      <input type="hidden" name="cid" value={c.id} form="category-margins" />
                      <b>{c.name}</b>
                      <div className="text-xs text-muted">{c._count.games} game</div>
                    </td>
                    <td>
                      <input name={`bps_${c.id}`} form="category-margins" type="number" min={0} defaultValue={c.marginBps ?? ""} placeholder={`${s.defaultMarginBps} (default)`} className="input !w-36 !py-1.5" />
                    </td>
                    <td>
                      <input name={`flat_${c.id}`} form="category-margins" type="number" min={0} step={100} defaultValue={c.marginFlat} className="input !w-32 !py-1.5" />
                    </td>
                    <td>
                      <input name={`mbps_${c.id}`} form="category-margins" type="number" min={0} defaultValue={c.memberMarginBps ?? ""} placeholder={`${s.defaultMemberMarginBps} (default)`} className="input !w-36 !py-1.5" />
                    </td>
                    <td>
                      <input name={`mflat_${c.id}`} form="category-margins" type="number" min={0} step={100} defaultValue={c.memberMarginFlat} className="input !w-32 !py-1.5" />
                    </td>
                    <td className="whitespace-nowrap">
                      Rp {ex.price.toLocaleString("id-ID")}
                      <div className="text-xs text-muted">member {ex.memberPrice != null ? `Rp ${ex.memberPrice.toLocaleString("id-ID")}` : "= biasa"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button form="category-margins" className="btn-primary mt-3">Simpan markup &amp; terapkan ke harga</button>
      </section>

      <form action={settingsAction} className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Toko</h2>
        <div className="sm:col-span-2"><ImageField name="logoUrl" label="Logo toko" defaultValue={s.logoUrl || null} hint="Persegi, latar transparan disarankan (PNG/WEBP). Kosong = logo bawaan" /></div>
        <div><label className="label">Nama toko</label><input name="storeName" defaultValue={s.storeName} className="input" /></div>
        <div><label className="label">WhatsApp CS</label><input name="whatsappCs" defaultValue={s.whatsappCs} className="input" placeholder="628…" /></div>
        <div className="sm:col-span-2"><label className="label">Tagline</label><input name="tagline" defaultValue={s.tagline} className="input" /></div>
        <h2 className="font-bold sm:col-span-2 mt-2">Kontak usaha</h2>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">
          Tampil di halaman Kontak, footer, Syarat &amp; Ketentuan dan Kebijakan Refund — wajib untuk verifikasi merchant payment gateway.
        </p>
        <div><label className="label">Email kontak</label><input name="contactEmail" type="email" defaultValue={s.contactEmail} className="input" placeholder="support@domain.com" /></div>
        <div><label className="label">Telepon kontak</label><input name="contactPhone" defaultValue={s.contactPhone} className="input" placeholder="0812…" /></div>
        <div className="sm:col-span-2"><label className="label">Nama usaha / badan hukum</label><input name="businessName" defaultValue={s.businessName} className="input" placeholder={`Kosong = ${s.storeName}`} /></div>
        <div className="sm:col-span-2"><label className="label">Alamat usaha</label><textarea name="businessAddress" defaultValue={s.businessAddress} rows={3} className="input" placeholder="Jalan, kota, provinsi, kode pos" /></div>
        <div>
          <label className="label">Markup default (bps)</label>
          <input name="defaultMarginBps" type="number" min={0} defaultValue={s.defaultMarginBps} className="input" />
          <p className="mt-1 text-xs text-muted">500 = 5% di atas modal. Dipakai kategori yang markup %-nya kosong</p>
        </div>
        <div>
          <label className="label">Markup member default (bps)</label>
          <input name="defaultMemberMarginBps" type="number" min={0} defaultValue={s.defaultMemberMarginBps} className="input" />
          <p className="mt-1 text-xs text-muted">400 = 4% di atas modal. Sama/lebih besar dari markup biasa = tanpa harga member</p>
        </div>
        <div>
          <label className="label">Sync produk otomatis (menit)</label>
          <input name="autoSyncMinutes" type="number" min={0} defaultValue={s.autoSyncMinutes} className="input" />
          <p className="mt-1 text-xs text-muted">Harga ikut modal Payterra tiap interval ini. 0 = mati</p>
        </div>
        <div className="sm:col-span-2"><button className="btn-primary">Simpan</button></div>
      </form>
    </div>
  );
}
