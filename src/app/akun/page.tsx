import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateTime, rupiah } from "@/lib/format";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";
import { logout } from "../(auth)/actions";

export const metadata = { title: "Akun Saya", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AkunPage() {
  const user = await requireUser();
  const [orders, stats] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        invoice: true, productName: true, total: true, paymentStatus: true, fulfillmentStatus: true, createdAt: true,
        game: { select: { name: true } },
      },
    }),
    db.order.aggregate({
      where: { userId: user.id, fulfillmentStatus: "SUCCESS" },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-extrabold text-accent-ink">
          {user.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">{user.name}</div>
          <div className="truncate text-sm text-muted">{user.email}</div>
          <span className="mt-1 inline-block rounded-full bg-accent-2/20 px-2 py-0.5 text-xs font-semibold text-accent-2">
            {user.role === "ADMIN" ? "Admin" : "Member"}
          </span>
        </div>
        <form action={logout}>
          <button className="btn-ghost">Keluar</button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted">Transaksi sukses</div>
          <div className="mt-1 text-xl font-bold">{stats._count}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Total belanja</div>
          <div className="mt-1 text-xl font-bold">{rupiah(stats._sum.total ?? 0)}</div>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Riwayat Transaksi</h2>
      {orders.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Belum ada transaksi. <Link href="/" className="text-accent hover:underline">Mulai top up</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link key={o.invoice} href={`/invoice/${o.invoice}`} className="card flex flex-wrap items-center gap-3 p-4 hover:border-muted">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{o.game.name} · {o.productName}</div>
                <div className="font-mono text-xs text-muted">{o.invoice} · {dateTime(o.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{rupiah(o.total)}</div>
                <div className="mt-1 flex justify-end gap-1">
                  {o.paymentStatus === "PAID" ? <FulfillmentBadge s={o.fulfillmentStatus} /> : <PaymentBadge s={o.paymentStatus} />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
