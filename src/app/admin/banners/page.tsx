import type { Banner } from "@prisma/client";
import { db } from "@/lib/db";
import { deleteBannerAction, saveBannerAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";
import { ImageField } from "../ImageField";

function BannerForm({ b }: { b?: Banner }) {
  return (
    <form action={saveBannerAction} className="card grid gap-3 p-4 sm:grid-cols-2">
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="sm:row-span-2">
        <ImageField
          name="imageUrl"
          label="Gambar banner"
          defaultValue={b?.imageUrl}
          aspect="aspect-[16/6]"
          hint="Disarankan 1600×550. Kosong = latar gradient + judul"
        />
      </div>
      <div><label className="label">Judul</label><input name="title" defaultValue={b?.title} className="input !py-1.5" required /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Subjudul</label><input name="subtitle" defaultValue={b?.subtitle ?? ""} className="input !py-1.5" /></div>
        <div><label className="label">Link</label><input name="linkUrl" defaultValue={b?.linkUrl ?? ""} placeholder="/games/mobile-legends" className="input !py-1.5" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} /> Aktif</label>
        <label className="flex items-center gap-1.5 text-sm">Urut <input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className="input !w-16 !py-1" /></label>
        <button className="btn-primary ml-auto !py-1.5">{b ? "Simpan" : "Tambah banner"}</button>
        {b && <button formAction={deleteBannerAction} formNoValidate className="btn-danger !py-1.5">Hapus</button>}
      </div>
    </form>
  );
}

export default async function AdminBanners({ searchParams }: { searchParams: FlashSP }) {
  const banners = await db.banner.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Banner Beranda</h1>
      <p className="mb-4 text-sm text-muted">Tampil sebagai carousel di beranda. Jika ada gambar, judul tetap ditampilkan di atasnya.</p>
      <Flash sp={await searchParams} />
      <div className="space-y-3">
        {banners.map((b) => <BannerForm key={b.id} b={b} />)}
        <h2 className="pt-4 font-semibold">Tambah banner</h2>
        <BannerForm />
      </div>
    </div>
  );
}
