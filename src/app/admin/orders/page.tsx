import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dateTime, rupiah } from "@/lib/format";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";

const PAGE = 30;

const FILTERS: Record<string, Prisma.OrderWhereInput> = {
  all: {},
  attention: { paymentStatus: "PAID", fulfillmentStatus: { in: ["FAILED", "WAITING"] } },
  unpaid: { paymentStatus: "UNPAID" },
  processing: { fulfillmentStatus: "PROCESSING" },
  success: { fulfillmentStatus: "SUCCESS" },
  failed: { fulfillmentStatus: "FAILED" },
  refunded: { fulfillmentStatus: "REFUNDED" },
  expired: { paymentStatus: "EXPIRED" },
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in FILTERS ? sp.status : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where: Prisma.OrderWhereInput = {
    ...FILTERS[status],
    ...(q
      ? { OR: [{ invoice: { contains: q.toUpperCase() } }, { contactPhone: { contains: q } }, { nickname: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { game: { select: { name: true } }, paymentMethod: { select: { name: true } } },
    }),
    db.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: Record<string, string | number | undefined>) =>
    "?" + new URLSearchParams(Object.entries({ status, q, page, ...p }).filter(([, v]) => v != null && v !== "") as [string, string][]).toString();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Transaksi</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(FILTERS).map((f) => (
          <Link
            key={f}
            href={qs({ status: f, page: 1 })}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${status === f ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}
          >
            {f}
          </Link>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Invoice / HP / nickname" className="input !py-1.5" />
          <button className="btn-ghost !py-1.5">Cari</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Invoice</th><th>Item</th><th>Akun</th><th>Total</th><th>Laba</th><th>Bayar</th><th>Proses</th><th>Waktu</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-mono text-accent hover:underline">{o.invoice}</Link></td>
                <td>{o.game.name}<div className="text-xs text-muted">{o.productName}</div></td>
                <td className="font-mono text-xs">{Object.values(o.accountData as Record<string, string>).join(" / ") || "-"}<div className="font-sans text-muted">{o.nickname}</div></td>
                <td>{rupiah(o.total)}<div className="text-xs text-muted">{o.paymentMethod.name}</div></td>
                <td>{rupiah(o.price - o.basePrice)}</td>
                <td><PaymentBadge s={o.paymentStatus} /></td>
                <td><FulfillmentBadge s={o.fulfillmentStatus} /></td>
                <td className="whitespace-nowrap text-muted">{dateTime(o.createdAt)}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={8} className="py-8 text-center text-muted">Tidak ada transaksi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{total} transaksi</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn-ghost !py-1.5" href={qs({ page: page - 1 })}>‹ Sebelumnya</Link>}
          <span className="py-1.5">Hal {page}/{pages}</span>
          {page < pages && <Link className="btn-ghost !py-1.5" href={qs({ page: page + 1 })}>Berikutnya ›</Link>}
        </div>
      </div>
    </div>
  );
}
