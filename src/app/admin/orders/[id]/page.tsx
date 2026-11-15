import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateTime, rupiah } from "@/lib/format";
import { refreshOrder } from "@/lib/orders";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";
import { orderAction } from "../../actions";
import { Flash, type FlashSP } from "../../Flash";

export default async function AdminOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: FlashSP }) {
  const { id } = await params;
  const pre = await db.order.findUnique({ where: { id }, select: { invoice: true } });
  if (!pre) notFound();
  await refreshOrder(pre.invoice);
  const o = await db.order.findUniqueOrThrow({
    where: { id },
    include: {
      game: true,
      product: true,
      paymentMethod: true,
      paymentGateway: { select: { name: true, provider: true } },
      user: { select: { name: true, email: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  const rows: [string, React.ReactNode][] = [
    ["Invoice", <span key="i" className="font-mono">{o.invoice}</span>],
    ["Game / Item", `${o.game.name} · ${o.productName}`],
    ["Kode produk biller", <span key="c" className="font-mono">{o.product.billerProductCode}</span>],
    ["Akun", <pre key="a" className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(o.accountData)}</pre>],
    ["Nickname", o.nickname ?? "-"],
    ["Kontak", `${o.contactPhone}${o.contactEmail ? " · " + o.contactEmail : ""}`],
    ["Member", o.user ? `${o.user.name} (${o.user.email})` : "Tamu"],
    ["Harga / Biaya / Total", `${rupiah(o.price)} / ${rupiah(o.fee)} / ${rupiah(o.total)}`],
    ["Modal / Laba", `${rupiah(o.basePrice)} / ${rupiah(o.price - o.basePrice)}`],
    ["Metode", o.paymentMethod.name],
    ["Gateway", o.paymentGateway ? `${o.paymentGateway.name}` : "-"],
    ["Payment ref", o.paymentRef ?? "-"],
    ["Dibayar", o.paidAt ? dateTime(o.paidAt) : "-"],
    ["Ref biller (kita)", o.billerRefId ?? "-"],
    ["Ref biller (Payterra)", o.billerRef ?? "-"],
    ["SN", o.billerSn ?? "-"],
    ["Pesan biller", o.billerMessage ?? "-"],
    ["Percobaan kirim", String(o.fulfillAttempts)],
  ];

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-fg">‹ Transaksi</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold">{o.invoice}</h1>
        <PaymentBadge s={o.paymentStatus} />
        <FulfillmentBadge s={o.fulfillmentStatus} />
        <Link href={`/invoice/${o.invoice}`} className="ml-auto text-sm text-accent hover:underline" target="_blank">
          Lihat halaman pembeli ↗
        </Link>
      </div>
      <Flash sp={await searchParams} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-4">
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[160px_1fr] gap-3 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <h2 className="font-bold">Tindakan</h2>
            {o.paymentStatus === "PAID" && o.fulfillmentStatus === "FAILED" ? (
              <>
                <form action={orderAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="op" value="retry" />
                  <button className="btn-primary w-full">Kirim ulang ke biller</button>
                </form>
                <form action={orderAction} className="space-y-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="op" value="refund" />
                  <input name="note" className="input" placeholder="Catatan refund (mis. transfer BCA 14/11)" />
                  <button className="btn-danger w-full">Tandai sudah di-refund</button>
                </form>
              </>
            ) : (o.paymentStatus === "UNPAID" || o.paymentStatus === "EXPIRED") ? (
              <div className="space-y-2">
                {o.paymentGateway && o.paymentGateway.provider !== "MOCK" && (
                  <form action={orderAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="op" value="checkPayment" />
                    <button className="btn-primary w-full">Cek status di {o.paymentGateway.name}</button>
                  </form>
                )}
                <form action={orderAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="op" value="markPaid" />
                  <button className="btn-ghost w-full">Tandai lunas manual (sudah cek mutasi)</button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted">Tidak ada tindakan untuk status ini.</p>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-bold">Riwayat</h2>
            <ol className="space-y-3 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <div className="font-medium">{e.message}</div>
                  <div className="text-xs text-muted">{e.type} · {dateTime(e.createdAt)}</div>
                  {e.data != null && (
                    <details className="mt-1 text-xs text-muted">
                      <summary className="cursor-pointer">data</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(e.data, null, 2)}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
