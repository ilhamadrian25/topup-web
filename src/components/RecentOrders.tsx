"use client";

import { ChevronRight, Clock, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dateTime, rupiah } from "@/lib/format";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";
import {
  clearRecentOrders,
  isOpenOrder,
  loadRecentOrders,
  onRecentOrdersChange,
  removeRecentOrder,
  saveRecentOrder,
  toRecentOrder,
  type RecentOrder,
} from "@/lib/recent-orders";

function useRecentOrders(): RecentOrder[] | null {
  // null sampai terbaca di browser (hindari hydration mismatch).
  const [list, setList] = useState<RecentOrder[] | null>(null);
  useEffect(() => {
    const read = () => setList(loadRecentOrders());
    read();
    return onRecentOrdersChange(read);
  }, []);
  return list;
}

/** Perbarui status pesanan yang belum final dari server (sekali per mount). */
function useRefreshOpen(list: RecentOrder[] | null) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!list || done) return;
    setDone(true);
    for (const o of list.filter(isOpenOrder)) {
      fetch(`/api/orders/${encodeURIComponent(o.invoice)}`, { cache: "no-store" })
        .then(async (r) => {
          if (r.ok) saveRecentOrder(toRecentOrder(await r.json()));
          else if (r.status === 404) removeRecentOrder(o.invoice);
        })
        .catch(() => {});
    }
  }, [list, done]);
}

/** Daftar pesanan dari browser ini, di halaman Cek Transaksi. */
export function RecentOrders() {
  const list = useRecentOrders();
  useRefreshOpen(list);
  if (!list || list.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">Pesanan di perangkat ini</h2>
        <button
          type="button"
          className="text-xs text-muted hover:text-danger"
          onClick={() => {
            if (confirm("Hapus riwayat pesanan dari browser ini? Pesanan di server tidak terhapus.")) clearRecentOrders();
          }}
        >
          Hapus riwayat
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((o) => (
          <li key={o.invoice} className="card flex items-center gap-2 p-3">
            <Link href={`/invoice/${o.invoice}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {o.gameName} · {o.productName}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-xs text-muted">{o.invoice}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {o.paymentStatus === "PAID" ? <FulfillmentBadge s={o.fulfillmentStatus} /> : <PaymentBadge s={o.paymentStatus} />}
                <span className="text-muted">
                  {rupiah(o.total)} · {dateTime(o.createdAt)}
                </span>
              </div>
            </Link>
            <button
              type="button"
              aria-label={`Hapus ${o.invoice} dari riwayat`}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
              onClick={() => removeRecentOrder(o.invoice)}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Tersimpan di browser ini saja. Simpan nomor invoice kalau ganti perangkat.</p>
    </section>
  );
}

/** Banner di atas halaman selama masih ada pesanan yang menunggu bayar / diproses. */
export function OpenOrderBanner() {
  const pathname = usePathname();
  const list = useRecentOrders();
  useRefreshOpen(list);
  const open = (list ?? []).filter(isOpenOrder);
  if (open.length === 0 || pathname.startsWith("/invoice") || pathname.startsWith("/admin") || pathname.startsWith("/cek-transaksi")) return null;
  const first = open[0];
  const href = open.length === 1 ? `/invoice/${first.invoice}` : "/cek-transaksi";
  const label =
    open.length === 1
      ? `${first.paymentStatus === "UNPAID" ? "Menunggu pembayaran" : "Sedang diproses"}: ${first.gameName} · ${first.productName}`
      : `${open.length} pesanan belum selesai`;
  return (
    <div className="mx-auto mt-3 w-full max-w-6xl px-4">
      <Link href={href} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-orange-50 px-3.5 py-2.5 text-sm text-fg hover:border-accent">
        <Clock className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="shrink-0 text-xs font-semibold text-accent">Lihat</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-accent" />
      </Link>
    </div>
  );
}
