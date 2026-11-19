import { getSettings } from "@/lib/settings";
import { biller } from "@/lib/biller";
import { db } from "@/lib/db";
import { applyMargin, categoryMargin } from "@/lib/settings";
import { repriceCategoryAction, saveCategoryMarginsAction, settingsAction, syncAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";
import { ImageField } from "../ImageField";

export default async function AdminSettings({ searchParams }: { searchParams: FlashSP }) {
  const [s, categories] = await Promise.all([
    getSettings(),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { games: true } } } }),
  ]);
  const b = biller();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Pengaturan & Sync</h1>
      <Flash sp={await searchParams} />

      <section className="card p-4">
        <h2 className="font-bold">Sync produk dari biller</h2>
        <p className="mt-1 text-sm text-muted">
          Biller aktif: <b className="font-mono">{b.name}</b>
          {b.name === "mock" && " (mock — API merchant Payterra belum tersedia)"}. Sync menarik semua produk, mencocokkan
          ke game lewat kode brand, memperbarui modal & ketersediaan. Harga jual yang sudah diatur tidak diubah kecuali
          modal naik melewati harga jual.
        </p>
        <form action={syncAction} className="mt-3">
          <button className="btn-primary">Sync Produk Sekarang</button>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="font-bold">Margin per kategori</h2>
        <p className="mt-1 text-sm text-muted">
          Harga jual = modal + margin % + margin tetap (Rp), dibulatkan ke atas ke kelipatan 100. Margin % kosong = pakai margin
          default ({s.defaultMarginBps / 100}%). Dipakai untuk produk baru saat sync; untuk produk yang sudah ada klik
          &quot;Terapkan ke harga&quot; (harga jual & member semua produk di kategori itu dihitung ulang).
        </p>
        <form action={saveCategoryMarginsAction} id="category-margins" />
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Kategori</th><th>Margin % (bps)</th><th>Margin tetap (Rp)</th><th>Contoh modal Rp 10.000</th><th /></tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const m = categoryMargin(c, s.defaultMarginBps);
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
                    <td className="whitespace-nowrap">Rp {applyMargin(10_000, m.bps, m.flat).toLocaleString("id-ID")}</td>
                    <td>
                      <form action={repriceCategoryAction}>
                        <input type="hidden" name="cid" value={c.id} />
                        <button className="btn-ghost !py-1.5 whitespace-nowrap">Terapkan ke harga</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button form="category-margins" className="btn-primary mt-3">Simpan margin kategori</button>
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
          <label className="label">Margin default produk baru (bps)</label>
          <input name="defaultMarginBps" type="number" defaultValue={s.defaultMarginBps} className="input" />
          <p className="mt-1 text-xs text-muted">500 = 5% di atas modal</p>
        </div>
        <div>
          <label className="label">Diskon member (bps dari harga jual)</label>
          <input name="memberDiscountBps" type="number" defaultValue={s.memberDiscountBps} className="input" />
          <p className="mt-1 text-xs text-muted">100 = 1%. 0 = tanpa harga member</p>
        </div>
        <div className="sm:col-span-2"><button className="btn-primary">Simpan</button></div>
      </form>
    </div>
  );
}
