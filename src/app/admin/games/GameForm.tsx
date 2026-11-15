import type { Category, Game } from "@prisma/client";
import { saveGameAction } from "../actions";
import { ImageField } from "../ImageField";

export function GameForm({ game, categories }: { game?: Game; categories: Category[] }) {
  const f = (label: string, name: keyof Game, opts: { placeholder?: string; required?: boolean } = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        className="input"
        defaultValue={(game?.[name] as string | number | null | undefined) ?? ""}
        placeholder={opts.placeholder}
        required={opts.required}
      />
    </div>
  );
  return (
    <form action={saveGameAction} className="card grid gap-3 p-4 sm:grid-cols-2">
      {game && <input type="hidden" name="id" value={game.id} />}
      {f("Nama", "name", { required: true })}
      {f("Slug URL", "slug", { required: true, placeholder: "mobile-legends" })}
      {f("Publisher", "publisher")}
      {f("Kode brand biller (Payterra)", "billerBrandCode", { required: true, placeholder: "MLBB" })}
      <div>
        <label className="label" htmlFor="categoryId">Kategori</label>
        <select id="categoryId" name="categoryId" className="input" defaultValue={game?.categoryId}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {f("Urutan", "sortOrder")}
      <ImageField name="imageUrl" label="Logo / cover (persegi)" defaultValue={game?.imageUrl} hint="Disarankan 512×512, PNG/JPG/WEBP maks 2 MB" />
      <ImageField name="bannerUrl" label="Banner halaman game (lebar)" defaultValue={game?.bannerUrl} aspect="aspect-[16/7]" hint="Disarankan 1600×500. Kosong = pakai logo diblur" />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="inputFields">Input akun (JSON)</label>
        <textarea
          id="inputFields"
          name="inputFields"
          rows={4}
          className="input font-mono text-xs"
          defaultValue={JSON.stringify(game?.inputFields ?? [{ key: "userId", label: "User ID" }], null, 2)}
        />
        <p className="mt-1 text-xs text-muted">
          Kosongkan jadi <code>[]</code> untuk voucher. Field select: tambahkan <code>{`"options":[{"value":"asia","label":"Asia"}]`}</code>.
          Field pertama = ID utama.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="inputHint">Petunjuk cari ID</label>
        <input id="inputHint" name="inputHint" className="input" defaultValue={game?.inputHint ?? ""} />
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-3 sm:col-span-2">
        <div className="text-xs font-bold text-muted uppercase">SEO (opsional — kosong = otomatis)</div>
        <div>
          <label className="label" htmlFor="seoTitle">Judul halaman</label>
          <input id="seoTitle" name="seoTitle" maxLength={70} className="input" defaultValue={game?.seoTitle ?? ""} placeholder={`Top Up ${game?.name ?? "Nama Game"} Termurah mulai Rp …`} />
        </div>
        <div>
          <label className="label" htmlFor="seoDescription">Meta description</label>
          <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={2} className="input" defaultValue={game?.seoDescription ?? ""} placeholder="Maks ~160 karakter, tampil di hasil pencarian Google" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Deskripsi (tampil di bagian “Tentang”)</label>
        <textarea id="description" name="description" rows={2} className="input" defaultValue={game?.description ?? ""} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
        {([["isActive", "Aktif"], ["isPopular", "Populer"], ["nicknameCheck", "Cek nickname"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" name={k} defaultChecked={game ? game[k] : k !== "isPopular"} /> {l}
          </label>
        ))}
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary">{game ? "Simpan game" : "Tambah game"}</button>
      </div>
    </form>
  );
}
