import { PlugZap, Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import type { BillerProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { BILLER_PROVIDERS } from "@/lib/biller";
import { decryptJson, mask } from "@/lib/secrets";
import { siteUrl } from "@/lib/seo";
import { billerOpAction, saveBillerAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";

export const dynamic = "force-dynamic";

function safeSecrets(blob: string | null) {
  try {
    return { values: decryptJson(blob), broken: false };
  } catch {
    return { values: {} as Record<string, string>, broken: true };
  }
}

export default async function AdminBillers({ searchParams }: { searchParams: FlashSP }) {
  const accounts = await db.billerAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { orders: true } } },
  });
  const providers = Object.entries(BILLER_PROVIDERS) as [BillerProvider, (typeof BILLER_PROVIDERS)[BillerProvider]][];
  const hasActive = accounts.some((a) => a.isActive);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Biller</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Biller adalah pemasok produk: saat pembayaran lunas, order dikirim ke biller yang <b>aktif</b>. Hanya satu biller aktif
        untuk order baru; order yang sedang diproses tetap dicek ke biller yang memprosesnya. Kredensial tersimpan
        terenkripsi. Provider yang didukung saat ini: <b>Payterra Open API</b> — ambil API Key, API Secret, dan Webhook Secret
        dari dashboard partner Payterra. Setelah mengaktifkan, jalankan{" "}
        <Link href="/admin/settings" className="text-accent hover:underline">Sync Produk</Link>; kode brand tiap game harus sama
        dengan kode brand di katalog biller (mis. <span className="font-mono">MLBB</span>).
      </p>
      {!hasActive && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Belum ada biller aktif — toko masih memakai biller dari env (<span className="font-mono">BILLER_PROVIDER</span>
          , default mock). Tambahkan dan aktifkan biller di bawah.
        </div>
      )}
      <Flash sp={await searchParams} />

      <div className="space-y-4">
        {accounts.map((a) => {
          const spec = BILLER_PROVIDERS[a.provider];
          const cfg = (a.config ?? {}) as Record<string, string>;
          const sec = safeSecrets(a.secrets);
          return (
            <div key={a.id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{a.name}</h2>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs">{a.code}</span>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-accent">{spec.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-2 text-muted"}`}>
                  {a.isActive ? "Aktif" : "Nonaktif"}
                </span>
                <span className="ml-auto text-xs text-muted">{a._count.orders} transaksi</span>
              </div>

              <form action={saveBillerAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={a.id} />
                <div>
                  <label className="label">Nama tampilan</label>
                  <input name="name" defaultValue={a.name} className="input" />
                </div>
                {spec.configFields.map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <input name={`cfg_${f.key}`} defaultValue={cfg[f.key] ?? ""} placeholder={f.placeholder} className="input font-mono" />
                  </div>
                ))}
                {spec.secretFields.map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <input
                      name={`sec_${f.key}`}
                      type="password"
                      autoComplete="new-password"
                      placeholder={sec.values[f.key] ? `Tersimpan (${mask(sec.values[f.key])}) — kosongkan untuk tetap` : "Belum diisi"}
                      className="input font-mono"
                    />
                    {sec.broken && <p className="mt-1 text-xs text-danger">Secret lama tidak bisa dibuka (kunci enkripsi berubah) — isi ulang.</p>}
                  </div>
                ))}
                {a.provider === "PAYTERRA" && (
                  <div className="sm:col-span-2">
                    <label className="label">URL webhook (daftarkan di dashboard partner Payterra)</label>
                    <input readOnly value={siteUrl(`/api/biller/callback/${a.code}`)} className="input font-mono text-xs" />
                  </div>
                )}
                <div className="flex justify-end sm:col-span-2">
                  <button className="btn-primary">Simpan</button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <form action={billerOpAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="op" value="test" />
                  <button className="btn-ghost !py-1.5 text-sm"><PlugZap className="h-4 w-4" /> Tes koneksi</button>
                </form>
                <form action={billerOpAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="op" value={a.isActive ? "deactivate" : "activate"} />
                  {a.isActive ? (
                    <button className="btn-ghost !py-1.5 text-sm"><PowerOff className="h-4 w-4" /> Nonaktifkan</button>
                  ) : (
                    <button className="btn-ghost !py-1.5 text-sm"><Power className="h-4 w-4" /> Jadikan biller aktif</button>
                  )}
                </form>
                {!a.isActive && a._count.orders === 0 && (
                  <form action={billerOpAction} className="ml-auto">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="op" value="delete" />
                    <button className="btn-danger !py-1.5 text-sm"><Trash2 className="h-4 w-4" /> Hapus</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}

        <form action={saveBillerAction} className="card grid gap-3 border-dashed p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="sm:col-span-4"><h2 className="font-bold">Tambah biller</h2></div>
          <div>
            <label className="label">Provider</label>
            <select name="provider" className="input">
              {providers.map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kode (untuk URL webhook)</label>
            <input name="code" placeholder="payterra" className="input font-mono" required />
          </div>
          <div>
            <label className="label">Nama</label>
            <input name="name" placeholder="Payterra" className="input" />
          </div>
          <button className="btn-primary">Tambah</button>
          <p className="text-xs text-muted sm:col-span-4">Biller baru dibuat nonaktif. Isi kredensial, tes koneksi, lalu jadikan biller aktif.</p>
        </form>
      </div>
    </div>
  );
}
