import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { biller } from "@/lib/biller";
import { dateTime, rupiah } from "@/lib/format";
import { GameCover } from "@/components/GameCover";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";
import { DailyChart, type DayPoint } from "./DailyChart";

const RANGES = { today: { label: "Hari ini", days: 1 }, "7d": { label: "7 hari", days: 7 }, "30d": { label: "30 hari", days: 30 } } as const;
type RangeKey = keyof typeof RANGES;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-muted">{cur > 0 ? "baru" : "—"} vs periode lalu</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      <span className={`flex items-center font-bold ${up ? "text-success" : "text-danger"}`}>
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(pct).toFixed(pct > -10 && pct < 10 ? 1 : 0)}%
      </span>
      vs periode lalu
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
  tone = "orange",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  children?: React.ReactNode;
  tone?: "orange" | "green" | "violet" | "sky";
}) {
  const tones = { orange: "bg-orange-50 text-orange-600", green: "bg-green-50 text-green-600", violet: "bg-violet-50 text-violet-600", sky: "bg-sky-50 text-sky-600" };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-sm font-semibold text-muted">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Daftar bar horizontal (satu hue, magnitude) dengan nilai sebagai teks. */
function BarList({ rows, format }: { rows: { label: React.ReactNode; key: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Belum ada data di periode ini.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 font-bold">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 text-xs font-medium text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range: RangeKey = sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "7d";
  const days = RANGES[range].days;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  // Grafik minimal 14 hari supaya tren terbaca walau range "Hari ini".
  const chartDays = Math.max(days, 14);
  const chartStart = new Date();
  chartStart.setHours(0, 0, 0, 0);
  chartStart.setDate(chartStart.getDate() - (chartDays - 1));
  const from = prevStart < chartStart ? prevStart : chartStart;

  const [orders, attention, recent, balance, users] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: from } },
      select: {
        createdAt: true, total: true, price: true, basePrice: true, paymentStatus: true, fulfillmentStatus: true,
        productName: true, userId: true,
        game: { select: { name: true, imageUrl: true } },
        paymentMethod: { select: { name: true } },
      },
    }),
    db.order.findMany({
      where: { paymentStatus: "PAID", fulfillmentStatus: { in: ["FAILED", "WAITING"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, invoice: true, productName: true, total: true, billerMessage: true, createdAt: true, game: { select: { name: true } } },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, invoice: true, productName: true, total: true, paymentStatus: true, fulfillmentStatus: true, createdAt: true,
        game: { select: { name: true, imageUrl: true } },
      },
    }),
    biller().getBalance().catch(() => null),
    db.user.count({ where: { role: "MEMBER" } }),
  ]);

  const inCur = orders.filter((o) => o.createdAt >= start);
  const inPrev = orders.filter((o) => o.createdAt >= prevStart && o.createdAt < start);
  const ok = (l: typeof orders) => l.filter((o) => o.fulfillmentStatus === "SUCCESS");
  const sum = (l: typeof orders, f: (o: (typeof orders)[number]) => number) => l.reduce((a, o) => a + f(o), 0);

  const cur = { rev: sum(ok(inCur), (o) => o.total), profit: sum(ok(inCur), (o) => o.price - o.basePrice), n: ok(inCur).length };
  const prev = { rev: sum(ok(inPrev), (o) => o.total), profit: sum(ok(inPrev), (o) => o.price - o.basePrice), n: ok(inPrev).length };
  const paidCur = inCur.filter((o) => o.paymentStatus === "PAID");
  const successRate = paidCur.length ? (ok(inCur).length / paidCur.length) * 100 : 0;
  const conv = inCur.length ? (paidCur.length / inCur.length) * 100 : 0;
  const memberShare = ok(inCur).length ? (ok(inCur).filter((o) => o.userId).length / ok(inCur).length) * 100 : 0;

  // Seri harian
  const byDay = new Map<string, DayPoint>();
  for (let i = 0; i < chartDays; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    byDay.set(dayKey(d), { date: dayKey(d), revenue: 0, profit: 0, count: 0 });
  }
  for (const o of ok(orders)) {
    const p = byDay.get(dayKey(o.createdAt));
    if (p) {
      p.revenue += o.total;
      p.profit += o.price - o.basePrice;
      p.count++;
    }
  }
  const series = [...byDay.values()];

  // Status pesanan periode ini
  const statusRows = [
    { key: "success", label: "Sukses", n: inCur.filter((o) => o.fulfillmentStatus === "SUCCESS").length, cls: "bg-green-500", icon: "✓" },
    { key: "processing", label: "Diproses", n: inCur.filter((o) => o.fulfillmentStatus === "PROCESSING").length, cls: "bg-violet-500", icon: "↻" },
    { key: "unpaid", label: "Belum dibayar", n: inCur.filter((o) => o.paymentStatus === "UNPAID").length, cls: "bg-amber-400", icon: "…" },
    { key: "failed", label: "Gagal / refund", n: inCur.filter((o) => ["FAILED", "REFUNDED"].includes(o.fulfillmentStatus) && o.paymentStatus === "PAID").length, cls: "bg-red-500", icon: "!" },
    { key: "expired", label: "Kedaluwarsa", n: inCur.filter((o) => o.paymentStatus === "EXPIRED" || o.paymentStatus === "FAILED").length, cls: "bg-gray-300", icon: "×" },
  ];
  const statusTotal = Math.max(1, statusRows.reduce((a, r) => a + r.n, 0));

  // Top produk & metode bayar
  const top = new Map<string, { label: string; img: string | null; game: string; value: number; n: number }>();
  const pay = new Map<string, { value: number; n: number }>();
  for (const o of ok(inCur)) {
    const k = `${o.game.name}|${o.productName}`;
    const t = top.get(k) ?? { label: o.productName, img: o.game.imageUrl, game: o.game.name, value: 0, n: 0 };
    t.value += o.total;
    t.n++;
    top.set(k, t);
    const p = pay.get(o.paymentMethod.name) ?? { value: 0, n: 0 };
    p.value += o.total;
    p.n++;
    pay.set(o.paymentMethod.name, p);
  }
  const topRows = [...top.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5);
  const payRows = [...pay.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">Ringkasan penjualan {RANGES[range].label.toLowerCase()} terakhir.</p>
        </div>
        <div className="flex rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <Link
              key={k}
              href={`/admin?range=${k}`}
              className={`rounded-lg px-3 py-1.5 transition ${range === k ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
            >
              {RANGES[k].label}
            </Link>
          ))}
        </div>
      </div>

      {attention.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50">
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-danger">
            <AlertTriangle className="h-4 w-4" /> Perlu tindakan — sudah dibayar tapi gagal / belum terkirim
            <Link href="/admin/orders?status=attention" className="ml-auto flex items-center text-xs hover:underline">
              Lihat semua <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-red-100 border-t border-red-100 bg-white/60 text-sm">
            {attention.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 hover:bg-white">
                  <span className="font-mono text-xs font-semibold text-danger">{o.invoice}</span>
                  <span className="font-semibold">{o.game.name} · {o.productName}</span>
                  <span className="text-xs text-muted">{o.billerMessage ?? "Belum terkirim ke biller"}</span>
                  <span className="ml-auto font-bold">{rupiah(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={CircleDollarSign} label="Omzet" value={rupiah(cur.rev)} tone="orange">
          <Delta cur={cur.rev} prev={prev.rev} />
        </Kpi>
        <Kpi icon={TrendingUp} label="Laba kotor" value={rupiah(cur.profit)} tone="green">
          <Delta cur={cur.profit} prev={prev.profit} />
        </Kpi>
        <Kpi icon={ReceiptText} label="Transaksi sukses" value={cur.n.toLocaleString("id-ID")} tone="violet">
          <Delta cur={cur.n} prev={prev.n} />
        </Kpi>
        <Kpi icon={Wallet} label="Saldo biller" value={balance == null ? "—" : rupiah(balance)} tone="sky">
          <span className="text-xs text-muted">{balance == null ? "Gagal memuat saldo" : `${biller().name === "mock" ? "Mock · " : ""}Payterra merchant`}</span>
        </Kpi>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-bold">Omzet harian</h2>
              <p className="text-xs text-muted">Transaksi sukses, {chartDays} hari terakhir. Arahkan kursor ke bar untuk detail.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Total {chartDays} hari</div>
              <div className="font-black">{rupiah(series.reduce((a, d) => a + d.revenue, 0))}</div>
            </div>
          </div>
          <DailyChart data={series} />
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Kesehatan transaksi</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Sukses", successRate, "dari yang dibayar"],
              ["Konversi", conv, "order → bayar"],
              ["Member", memberShare, "dari sukses"],
            ].map(([l, v, d]) => (
              <div key={l as string} className="rounded-xl bg-surface-2 px-2 py-3">
                <div className="text-lg font-black">{(v as number).toFixed(0)}%</div>
                <div className="text-xs font-semibold">{l}</div>
                <div className="text-[10px] text-muted">{d}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2">
            {statusRows.filter((r) => r.n > 0).map((r) => (
              <div key={r.key} className={r.cls} style={{ width: `${(r.n / statusTotal) * 100}%` }} title={`${r.label}: ${r.n}`} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {statusRows.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-sm ${r.cls}`} />
                <span className="text-muted">{r.label}</span>
                <span className="ml-auto font-bold">{r.n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
            <CheckCircle2 className="h-4 w-4 text-success" /> {users.toLocaleString("id-ID")} member terdaftar
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Produk terlaris</h2>
          <BarList
            format={rupiah}
            rows={topRows.map(([k, r]) => ({
              key: k,
              value: r.value,
              sub: `${r.n}×`,
              label: (
                <span className="flex items-center gap-2">
                  <GameCover name={r.game} imageUrl={r.img} className="h-6 w-6 shrink-0 rounded-md" />
                  <span className="truncate">{r.label}</span>
                  <span className="truncate text-xs font-medium text-muted">{r.game}</span>
                </span>
              ),
            }))}
          />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Metode pembayaran</h2>
          <BarList format={rupiah} rows={payRows.map(([k, r]) => ({ key: k, label: k, value: r.value, sub: `${r.n}×` }))} />
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-bold">Transaksi terbaru</h2>
          <Link href="/admin/orders" className="flex items-center text-sm font-semibold text-accent hover:underline">
            Semua transaksi <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Invoice</th><th>Item</th><th>Total</th><th>Bayar</th><th>Proses</th><th>Waktu</th></tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-surface-2/60">
                  <td><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold text-accent hover:underline">{o.invoice}</Link></td>
                  <td>
                    <span className="flex items-center gap-2">
                      <GameCover name={o.game.name} imageUrl={o.game.imageUrl} className="h-7 w-7 shrink-0 rounded-md" />
                      <span><span className="font-semibold">{o.productName}</span><span className="block text-xs text-muted">{o.game.name}</span></span>
                    </span>
                  </td>
                  <td className="font-semibold">{rupiah(o.total)}</td>
                  <td><PaymentBadge s={o.paymentStatus} /></td>
                  <td><FulfillmentBadge s={o.fulfillmentStatus} /></td>
                  <td className="whitespace-nowrap text-muted">{dateTime(o.createdAt)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={6} className="py-8 text-center text-muted">Belum ada transaksi.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
