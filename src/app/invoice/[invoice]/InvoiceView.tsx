"use client";

import { Check, Copy, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dateTime, maskPhone, rupiah } from "@/lib/format";
import type { InputField, PaymentData } from "@/lib/types";
import type { PublicOrder } from "@/lib/orders";
import { FulfillmentBadge, PaymentBadge } from "@/components/StatusBadge";

type O = Omit<PublicOrder, "expiresAt" | "paidAt" | "fulfilledAt" | "createdAt"> & {
  expiresAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
};

function useCountdown(to: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  return { left: s, text: `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` };
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost !px-3 !py-1.5 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <><Check className="h-3.5 w-3.5" /> Disalin</> : <><Copy className="h-3.5 w-3.5" /> Salin</>}
    </button>
  );
}

const STEPS = ["Pesanan dibuat", "Pembayaran", "Diproses", "Selesai"];

export function InvoiceView({ initial, qrSvg, mockPayment }: { initial: O; qrSvg: string | null; mockPayment: boolean }) {
  const [o, setO] = useState<O>(initial);
  const [paying, setPaying] = useState(false);
  const cd = useCountdown(o.expiresAt);

  const final =
    o.paymentStatus === "EXPIRED" ||
    o.paymentStatus === "FAILED" ||
    ["SUCCESS", "FAILED", "REFUNDED"].includes(o.fulfillmentStatus);

  const reload = useCallback(async () => {
    const r = await fetch(`/api/orders/${o.invoice}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setO(await r.json());
  }, [o.invoice]);

  useEffect(() => {
    if (final) return;
    const t = setInterval(reload, o.paymentStatus === "PAID" ? 3000 : 5000);
    return () => clearInterval(t);
  }, [final, reload, o.paymentStatus]);

  async function simulatePay() {
    setPaying(true);
    await fetch("/api/payments/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: o.invoice }),
    }).catch(() => null);
    await reload();
    setPaying(false);
  }

  const pd = o.paymentData as PaymentData | null;
  const fields = (o.game.inputFields as InputField[]) ?? [];
  const account = o.accountData as Record<string, string>;

  const stepIdx =
    o.fulfillmentStatus === "SUCCESS" ? 4 : o.fulfillmentStatus === "PROCESSING" ? 2 : o.paymentStatus === "PAID" ? 2 : 1;
  const failed = o.fulfillmentStatus === "FAILED" || o.fulfillmentStatus === "REFUNDED" || o.paymentStatus !== "UNPAID" && o.paymentStatus !== "PAID";

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted">Nomor Invoice</div>
            <div className="flex items-center gap-2 font-mono text-lg font-bold">
              {o.invoice} <CopyButton value={o.invoice} />
            </div>
            <div className="mt-1 text-xs text-muted">{dateTime(o.createdAt)}</div>
          </div>
          <div className="flex gap-2">
            <PaymentBadge s={o.paymentStatus} />
            {o.paymentStatus === "PAID" && <FulfillmentBadge s={o.fulfillmentStatus} />}
          </div>
        </div>

        <ol className="mt-6 grid grid-cols-4 gap-2 text-center text-[11px] sm:text-xs">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx && !failed;
            return (
              <li key={s}>
                <div className={`h-1.5 rounded-full ${done ? "bg-accent" : active ? "animate-pulse bg-accent/50" : "bg-surface-2"}`} />
                <div className={`mt-2 ${done || active ? "text-fg" : "text-muted"}`}>{s}</div>
              </li>
            );
          })}
        </ol>
      </div>

      {o.paymentStatus === "UNPAID" && pd && (
        <div className="card p-5 text-center">
          <div className="text-sm text-muted">Selesaikan pembayaran dalam</div>
          <div className="mt-1 font-mono text-3xl font-bold text-accent">{cd.text}</div>
          <div className="mt-1 text-sm">
            Total bayar <b>{rupiah(o.total)}</b> via <b>{o.paymentMethod.name}</b>
          </div>

          {pd.type === "qris" && qrSvg && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="text-xs text-muted">Scan dengan aplikasi e-wallet atau m-banking apa pun.</p>
            </div>
          )}
          {pd.type === "va" && (
            <div className="mx-auto mt-5 max-w-sm rounded-xl bg-surface-2 p-4">
              <div className="text-xs text-muted">Nomor {pd.bank}</div>
              <div className="mt-1 flex items-center justify-center gap-2 font-mono text-2xl font-bold">
                {pd.vaNumber} <CopyButton value={pd.vaNumber} />
              </div>
            </div>
          )}
          {pd.type === "retail" && (
            <div className="mx-auto mt-5 max-w-sm rounded-xl bg-surface-2 p-4">
              <div className="text-xs text-muted">Kode bayar {pd.retailer}</div>
              <div className="mt-1 flex items-center justify-center gap-2 font-mono text-2xl font-bold">
                {pd.payCode} <CopyButton value={pd.payCode} />
              </div>
            </div>
          )}
          {pd.type === "ewallet" && (
            <a href={pd.checkoutUrl} className="btn-primary mt-5">
              Bayar dengan {pd.provider}
            </a>
          )}

          {pd.type === "redirect" && (
            <div className="mt-5">
              <a href={pd.url} className="btn-primary" rel="noopener noreferrer">
                Lanjut bayar dengan {pd.provider}
              </a>
              <p className="mt-2 text-xs text-muted">Kamu akan diarahkan ke halaman pembayaran aman. Status di sini diperbarui otomatis.</p>
            </div>
          )}

          {mockPayment && (
            <div className="mt-6 rounded-xl border border-dashed border-accent-2/60 p-3 text-sm">
              <div className="text-xs text-muted">Gateway MOCK (development) — tidak ada uang sungguhan</div>
              <button type="button" className="btn mt-2 bg-accent-2 text-white" disabled={paying} onClick={simulatePay}>
                {paying ? "Memproses…" : "Simulasikan pembayaran berhasil"}
              </button>
            </div>
          )}
        </div>
      )}

      {o.paymentStatus === "EXPIRED" && (
        <div className="card p-5 text-center">
          <p className="font-semibold">Invoice kedaluwarsa</p>
          <p className="mt-1 text-sm text-muted">Pembayaran tidak diterima sebelum batas waktu.</p>
          <Link href={`/games/${o.game.slug}`} className="btn-primary mt-4">
            Buat pesanan baru
          </Link>
        </div>
      )}

      {o.paymentStatus === "PAID" && (
        <div className="card p-5 text-center">
          {o.fulfillmentStatus === "SUCCESS" ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-success"><PartyPopper className="h-7 w-7" /></div>
              <p className="mt-2 text-lg font-bold">Top up berhasil!</p>
              {o.billerSn && (
                <div className="mx-auto mt-4 max-w-sm rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-muted">{fields.length ? "Serial Number" : "Kode Voucher"}</div>
                  <div className="mt-1 flex items-center justify-center gap-2 break-all font-mono text-lg font-bold">
                    {o.billerSn} <CopyButton value={o.billerSn} />
                  </div>
                </div>
              )}
            </>
          ) : o.fulfillmentStatus === "FAILED" ? (
            <>
              <p className="text-lg font-bold text-danger">Top up gagal diproses</p>
              <p className="mt-1 text-sm text-muted">
                Tenang, dana kamu aman. Tim kami akan memproses ulang atau melakukan refund. Simpan nomor invoice ini.
              </p>
            </>
          ) : o.fulfillmentStatus === "REFUNDED" ? (
            <p className="font-semibold">Pesanan ini sudah di-refund.</p>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
              <p className="mt-3 font-semibold">Pembayaran diterima, top up sedang diproses…</p>
              <p className="mt-1 text-sm text-muted">Biasanya selesai dalam beberapa detik.</p>
            </>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-3 font-bold">Detail Pesanan</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row k="Game" v={o.game.name} />
          <Row k="Item" v={o.productName} />
          {fields.map((f) => (
            <Row key={f.key} k={f.label} v={f.options?.find((x) => x.value === account[f.key])?.label ?? account[f.key]} />
          ))}
          {o.nickname && <Row k="Nickname" v={o.nickname} />}
          <Row k="WhatsApp" v={maskPhone(o.contactPhone)} />
          <Row k="Metode" v={o.paymentMethod.name} />
          <Row k="Harga" v={rupiah(o.price)} />
          <Row k="Biaya" v={rupiah(o.fee)} />
          <Row k="Total" v={rupiah(o.total)} bold />
        </dl>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v?: string | null; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-surface-2 px-3 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className={`text-right ${bold ? "font-bold text-accent" : ""}`}>{v || "-"}</dd>
    </div>
  );
}
