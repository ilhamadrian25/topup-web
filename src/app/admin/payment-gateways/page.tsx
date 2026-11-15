import { PlugZap, Trash2 } from "lucide-react";
import Link from "next/link";
import type { GatewayProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/lib/payment";
import { decryptJson, mask } from "@/lib/secrets";
import { siteUrl } from "@/lib/seo";
import { gatewayOpAction, saveGatewayAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";

export const dynamic = "force-dynamic";

function safeSecrets(blob: string | null) {
  try {
    return { values: decryptJson(blob), broken: false };
  } catch {
    return { values: {} as Record<string, string>, broken: true };
  }
}

export default async function AdminGateways({ searchParams }: { searchParams: FlashSP }) {
  const gateways = await db.paymentGateway.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { methods: true, orders: true } } },
  });
  const providers = Object.entries(PROVIDERS) as [GatewayProvider, (typeof PROVIDERS)[GatewayProvider]][];

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Payment Gateway</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Gateway diatur sepenuhnya dari sini (tersimpan di database, API key terenkripsi). Tiap metode di{" "}
        <Link href="/admin/payment-methods" className="text-accent hover:underline">Metode Pembayaran</Link> memilih gateway
        yang memprosesnya, jadi beberapa gateway bisa aktif bersamaan. Provider yang didukung saat ini: <b>iPaymu</b>.
      </p>
      <Flash sp={await searchParams} />

      <div className="space-y-4">
        {gateways.map((g) => {
          const spec = PROVIDERS[g.provider];
          const cfg = (g.config ?? {}) as Record<string, string>;
          const sec = safeSecrets(g.secrets);
          return (
            <div key={g.id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{g.name}</h2>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs">{g.code}</span>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-accent">{spec.label}</span>
                {g.provider !== "MOCK" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.isSandbox ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {g.isSandbox ? "Sandbox" : "Produksi"}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-2 text-muted"}`}>
                  {g.isActive ? "Aktif" : "Nonaktif"}
                </span>
                <span className="ml-auto text-xs text-muted">{g._count.methods} metode · {g._count.orders} transaksi</span>
              </div>

              <form action={saveGatewayAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={g.id} />
                <div>
                  <label className="label">Nama tampilan</label>
                  <input name="name" defaultValue={g.name} className="input" />
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
                {g.provider !== "MOCK" && (
                  <div className="sm:col-span-2">
                    <label className="label">URL callback (isi di dashboard gateway sebagai Notify URL)</label>
                    <input readOnly value={siteUrl(`/api/payments/callback/${g.code}`)} className="input font-mono text-xs" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  {g.provider !== "MOCK" && (
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isSandbox" defaultChecked={g.isSandbox} /> Sandbox</label>
                  )}
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isActive" defaultChecked={g.isActive} /> Aktif</label>
                  <button className="btn-primary ml-auto">Simpan</button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <form action={gatewayOpAction}>
                  <input type="hidden" name="id" value={g.id} />
                  <button name="op" value="test" className="btn-ghost !py-1.5 text-sm"><PlugZap className="h-4 w-4" /> Tes koneksi</button>
                </form>
                <form action={gatewayOpAction}>
                  <input type="hidden" name="id" value={g.id} />
                  <button name="op" value="useForAll" className="btn-ghost !py-1.5 text-sm">Pakai untuk semua metode</button>
                </form>
                {g._count.methods === 0 && g._count.orders === 0 && (
                  <form action={gatewayOpAction} className="ml-auto">
                    <input type="hidden" name="id" value={g.id} />
                    <button name="op" value="delete" className="btn-danger !py-1.5 text-sm"><Trash2 className="h-4 w-4" /> Hapus</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}

        <form action={saveGatewayAction} className="card grid gap-3 border-dashed p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="sm:col-span-4"><h2 className="font-bold">Tambah gateway</h2></div>
          <div>
            <label className="label">Provider</label>
            <select name="provider" className="input">
              {providers.map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kode (untuk URL callback)</label>
            <input name="code" placeholder="ipaymu-prod" className="input font-mono" required />
          </div>
          <div>
            <label className="label">Nama</label>
            <input name="name" placeholder="iPaymu Produksi" className="input" />
          </div>
          <input type="hidden" name="isSandbox" value="on" />
          <button className="btn-primary">Tambah</button>
          <p className="text-xs text-muted sm:col-span-4">Gateway baru dibuat nonaktif. Isi kredensial, tes koneksi, lalu aktifkan.</p>
        </form>
      </div>
    </div>
  );
}
