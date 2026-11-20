import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RecentOrders } from "@/components/RecentOrders";

export const metadata = {
  title: "Cek Status Transaksi Top Up",
  description: "Cek status pesanan top up game dan voucher kamu dengan nomor invoice.",
  alternates: { canonical: "/cek-transaksi" },
};

async function lookup(formData: FormData) {
  "use server";
  const inv = String(formData.get("invoice") ?? "").trim().toUpperCase();
  if (!inv) redirect("/cek-transaksi?e=1");
  const found = await db.order.findUnique({ where: { invoice: inv }, select: { invoice: true } });
  redirect(found ? `/invoice/${found.invoice}` : `/cek-transaksi?e=1&q=${encodeURIComponent(inv)}`);
}

export default async function CekTransaksi({ searchParams }: { searchParams: Promise<{ e?: string; q?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-extrabold">Cek Transaksi</h1>
      <p className="mt-1 text-sm text-muted">Masukkan nomor invoice untuk melihat status pesanan kamu.</p>
      <form action={lookup} className="card mt-6 space-y-3 p-5">
        <input name="invoice" defaultValue={sp.q} placeholder="Contoh: TW261114A1B2C3D4" className="input font-mono uppercase" />
        {sp.e && <p className="text-sm text-danger">Invoice tidak ditemukan.</p>}
        <button className="btn-primary w-full">Cek Status</button>
      </form>
      <RecentOrders />
    </div>
  );
}
