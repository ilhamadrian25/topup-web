import Link from "next/link";
import { db } from "@/lib/db";
import { savePaymentMethodAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";
import { ImageField } from "../ImageField";

// Nilai iPaymu yang umum (bisa diketik bebas). "redirect" = halaman bayar iPaymu.
const IPAYMU_METHODS = ["va", "qris", "cstore", "redirect"];
const IPAYMU_CHANNELS = ["bca", "bni", "bri", "mandiri", "cimb", "permata", "bsi", "danamon", "bag", "bmi", "mpm", "qris", "alfamart", "indomaret"];

export default async function AdminPaymentMethods({ searchParams }: { searchParams: FlashSP }) {
  const [methods, gateways] = await Promise.all([
    db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" }, include: { gateway: { select: { isActive: true } } } }),
    db.paymentGateway.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, provider: true, isActive: true } }),
  ]);

  const gatewaySelect = (value: string | null) => (
    <select name="gatewayId" defaultValue={value ?? ""} className="input !py-1.5">
      <option value="">— tidak ada (nonaktif) —</option>
      {gateways.map((g) => (
        <option key={g.id} value={g.id}>{g.name}{g.isActive ? "" : " (nonaktif)"}</option>
      ))}
    </select>
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Metode Pembayaran</h1>
      <p className="mb-4 text-sm text-muted">
        Tiap metode diproses oleh satu <Link href="/admin/payment-gateways" className="text-accent hover:underline">gateway</Link>.
        Metode hanya tampil di toko kalau metode <i>dan</i> gateway-nya aktif. Biaya = flat + (harga × bps / 10000), dibebankan ke pembeli.
      </p>
      <Flash sp={await searchParams} />

      <datalist id="gw-methods">{IPAYMU_METHODS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="gw-channels">{IPAYMU_CHANNELS.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="space-y-3">
        {methods.map((m) => (
          <form key={m.id} action={savePaymentMethodAction} className="card grid gap-4 p-4 lg:grid-cols-[220px_1fr]">
            <input type="hidden" name="id" value={m.id} />
            <ImageField name="imageUrl" label={`Logo (${m.code} · ${m.group})`} defaultValue={m.imageUrl} aspect="aspect-[3/2]" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                <div className="col-span-2"><label className="label">Nama</label><input name="name" defaultValue={m.name} className="input !py-1.5" /></div>
                <div><label className="label">Fee flat</label><input name="feeFlat" type="number" defaultValue={m.feeFlat} className="input !py-1.5" /></div>
                <div><label className="label">Fee bps</label><input name="feeBps" type="number" defaultValue={m.feeBps} className="input !py-1.5" /></div>
                <div><label className="label">Min</label><input name="minAmount" type="number" defaultValue={m.minAmount} className="input !py-1.5" /></div>
                <div><label className="label">Max</label><input name="maxAmount" type="number" defaultValue={m.maxAmount ?? ""} className="input !py-1.5" /></div>
                <div><label className="label">Urut</label><input name="sortOrder" type="number" defaultValue={m.sortOrder} className="input !py-1.5" /></div>
              </div>
              <div className="grid grid-cols-2 items-end gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-4">
                <div className="col-span-2">
                  <label className="label">Gateway</label>
                  {gatewaySelect(m.gatewayId)}
                </div>
                <div><label className="label">Metode gateway</label><input name="gatewayMethod" list="gw-methods" defaultValue={m.gatewayMethod ?? ""} placeholder="va" className="input !py-1.5 font-mono" /></div>
                <div><label className="label">Channel</label><input name="gatewayChannel" list="gw-channels" defaultValue={m.gatewayChannel ?? ""} placeholder="bca" className="input !py-1.5 font-mono" /></div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isActive" defaultChecked={m.isActive} /> Aktif</label>
                {m.isActive && !m.gateway?.isActive && (
                  <span className="text-xs font-semibold text-danger">Tidak tampil di toko: gateway belum dipilih / nonaktif</span>
                )}
                <button className="btn-primary ml-auto !px-3 !py-1.5">Simpan</button>
              </div>
            </div>
          </form>
        ))}

        <form action={savePaymentMethodAction} className="card grid grid-cols-2 items-end gap-2 border-dashed p-4 sm:grid-cols-6">
          <div className="col-span-2 sm:col-span-6"><h2 className="font-bold">Tambah metode</h2></div>
          <div><label className="label">Kode</label><input name="code" placeholder="BNIVA" className="input !py-1.5 font-mono uppercase" required /></div>
          <div><label className="label">Nama</label><input name="name" placeholder="BNI Virtual Account" className="input !py-1.5" /></div>
          <div>
            <label className="label">Grup</label>
            <select name="group" className="input !py-1.5">
              <option value="VIRTUAL_ACCOUNT">Virtual Account</option>
              <option value="QRIS">QRIS</option>
              <option value="EWALLET">E-Wallet</option>
              <option value="RETAIL">Retail</option>
            </select>
          </div>
          <div><label className="label">Gateway</label>{gatewaySelect(gateways.find((g) => g.isActive && g.provider !== "MOCK")?.id ?? null)}</div>
          <div><label className="label">Metode / channel</label>
            <div className="flex gap-1">
              <input name="gatewayMethod" list="gw-methods" placeholder="va" className="input !py-1.5 font-mono" />
              <input name="gatewayChannel" list="gw-channels" placeholder="bni" className="input !py-1.5 font-mono" />
            </div>
          </div>
          <button className="btn-primary">Tambah</button>
        </form>
      </div>
    </div>
  );
}
