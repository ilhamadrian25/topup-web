"use client";

import { Check, CheckCircle2, Headphones, Info, ShoppingCart, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { rupiah } from "@/lib/format";
import { PayLogo } from "@/components/PayLogo";
import type { InputField } from "@/lib/types";

type Product = { id: string; name: string; price: number; normalPrice: number; memberPrice: number | null; available: boolean };
type Method = {
  code: string;
  name: string;
  group: "QRIS" | "VIRTUAL_ACCOUNT" | "EWALLET" | "RETAIL";
  feeFlat: number;
  feeBps: number;
  minAmount: number;
  maxAmount: number | null;
  imageUrl: string | null;
};

const GROUP_LABEL: Record<Method["group"], string> = {
  QRIS: "QRIS",
  EWALLET: "E-Wallet",
  VIRTUAL_ACCOUNT: "Virtual Account",
  RETAIL: "Gerai Retail",
};

const fee = (price: number, m: Method) => m.feeFlat + Math.ceil((price * m.feeBps) / 10000);

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="section-head">
        <span className="section-num">{n}</span>
        {title}
      </h2>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Gem({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path d="M6 3h12l4 6-10 12L2 9z" fill="url(#gem)" />
      <path d="M2 9h20M8 3l4 18 4-18M6 3l2 6m10-6-2 6" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" fill="none" />
    </svg>
  );
}

export function OrderForm(props: {
  gameSlug: string;
  fields: InputField[];
  inputHint: string | null;
  nicknameCheck: boolean;
  gameName: string;
  soldCount: number;
  lowPrice: number | null;
  products: Product[];
  methods: Method[];
  isMember: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<Record<string, string>>({});
  const [nick, setNick] = useState<{ state: "idle" | "loading" | "ok" | "err"; text?: string; for?: string }>({ state: "idle" });
  const [productId, setProductId] = useState<string | null>(null);
  const [methodCode, setMethodCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountKey = JSON.stringify(account);
  const product = props.products.find((p) => p.id === productId) ?? null;
  const method = props.methods.find((m) => m.code === methodCode) ?? null;
  const accountFilled = props.fields.every((f) => account[f.key]?.trim());
  const nickValid = !props.nicknameCheck || (nick.state === "ok" && nick.for === accountKey);

  const groups = useMemo(() => {
    const out = new Map<Method["group"], Method[]>();
    for (const m of props.methods) out.set(m.group, [...(out.get(m.group) ?? []), m]);
    return [...out.entries()];
  }, [props.methods]);

  async function checkNick() {
    setNick({ state: "loading" });
    const res = await fetch("/api/account-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameSlug: props.gameSlug, account }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    if (j?.ok) setNick({ state: "ok", text: j.nickname, for: accountKey });
    else setNick({ state: "err", text: j?.message ?? "Gagal cek akun" });
  }

  async function submit() {
    setError(null);
    if (!accountFilled) return setError("Lengkapi data akun terlebih dahulu");
    if (!nickValid) return setError("Cek akun dulu untuk memastikan ID benar");
    if (!product) return setError("Pilih nominal top up");
    if (!method) return setError("Pilih metode pembayaran");
    if (!phone.trim()) return setError("Isi nomor WhatsApp");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameSlug: props.gameSlug,
        productId: product.id,
        account,
        paymentMethodCode: method.code,
        phone,
        email: email || undefined,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    if (res?.ok && j?.invoice) {
      router.push(`/invoice/${j.invoice}`);
      return;
    }
    setSubmitting(false);
    setError(j?.message ?? "Gagal membuat pesanan");
  }

  const total = product && method ? product.price + fee(product.price, method) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {props.fields.length > 0 && (
          <Step n={1} title="Masukkan data akun">
            <div className={`grid gap-3 ${props.fields.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {props.fields.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={f.key}>
                    {f.label}
                  </label>
                  {f.options ? (
                    <select
                      id={f.key}
                      className="input"
                      value={account[f.key] ?? ""}
                      onChange={(e) => setAccount({ ...account, [f.key]: e.target.value })}
                    >
                      <option value="">Pilih {f.label}</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={f.key}
                      className="input"
                      inputMode="numeric"
                      placeholder={f.placeholder}
                      value={account[f.key] ?? ""}
                      onChange={(e) => setAccount({ ...account, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            {props.nicknameCheck && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!accountFilled || nick.state === "loading"}
                  onClick={checkNick}
                >
                  {nick.state === "loading" ? "Mengecek…" : "Cek Akun"}
                </button>
                {nick.state === "ok" && nick.for === accountKey && (
                  <span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm text-success">
                    <CheckCircle2 className="mr-1 inline h-4 w-4" />Nickname: <b>{nick.text}</b>
                  </span>
                )}
                {nick.state === "ok" && nick.for !== accountKey && (
                  <span className="text-sm text-warning">Data berubah, cek ulang akun</span>
                )}
                {nick.state === "err" && <span className="text-sm text-danger">{nick.text}</span>}
              </div>
            )}
            {props.inputHint && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 flex gap-2 text-xs text-muted"><Info className="h-4 w-4 shrink-0 text-accent" />{props.inputHint}</p>}
          </Step>
        )}

        <Step n={props.fields.length ? 2 : 1} title="Pilih nominal">
          {props.products.length === 0 ? (
            <p className="text-sm text-muted">Produk belum tersedia.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {props.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => setProductId(p.id)}
                  className={`relative flex min-h-[84px] flex-col justify-between rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    productId === p.id
                      ? "border-accent bg-orange-50 shadow-md shadow-accent/15"
                      : "border-line bg-surface hover:border-accent/50"
                  }`}
                >
                  {productId === p.id && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  )}
                  <div className="text-[13px] leading-snug font-semibold">{p.name}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Gem className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-sm font-extrabold text-accent">{rupiah(p.price)}</div>
                      {props.isMember && p.normalPrice > p.price && (
                        <div className="text-[11px] text-muted line-through">{rupiah(p.normalPrice)}</div>
                      )}
                    </div>
                  </div>
                  {p.memberPrice != null && (
                    <div className="mt-1 text-[11px] font-semibold text-accent-2">Member {rupiah(p.memberPrice)}</div>
                  )}
                  {!p.available && <div className="mt-1 text-[11px] font-semibold text-danger">Gangguan</div>}
                </button>
              ))}
            </div>
          )}
          {!props.isMember && props.products.some((p) => p.memberPrice != null) && (
            <p className="mt-3 text-xs text-muted">
              <Link href="/login" className="text-accent hover:underline">
                Masuk
              </Link>{" "}
              untuk dapat harga member.
            </p>
          )}
        </Step>

        <Step n={props.fields.length ? 3 : 2} title="Pilih pembayaran">
          <div className="space-y-4">
            {groups.map(([group, ms]) => (
              <div key={group}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{GROUP_LABEL[group]}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ms.map((m) => {
                    const t = product ? product.price + fee(product.price, m) : null;
                    const outOfRange = t != null && (t < m.minAmount || (m.maxAmount != null && t > m.maxAmount));
                    return (
                      <button
                        key={m.code}
                        type="button"
                        disabled={outOfRange}
                        onClick={() => setMethodCode(m.code)}
                        className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition disabled:opacity-40 ${
                          methodCode === m.code ? "border-accent bg-orange-50 ring-1 ring-accent" : "border-line bg-surface hover:border-accent/50"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 font-semibold"><PayLogo name={m.name} code={m.code} imageUrl={m.imageUrl} />{m.name}</span>
                        <span className="text-xs font-bold text-fg">
                          {t != null ? (outOfRange ? "Tidak tersedia" : rupiah(t)) : m.feeBps ? `+${m.feeBps / 100}%` : `+${rupiah(m.feeFlat)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step n={props.fields.length ? 4 : 3} title="Detail kontak">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="phone">
                No. WhatsApp
              </label>
              <input
                id="phone"
                className="input"
                inputMode="tel"
                placeholder="08xxxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email (opsional)
              </label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="kamu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">Bukti transaksi dikirim ke kontak ini.</p>
        </Step>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
        <div className="card p-4">
          <div className="grid grid-cols-2 divide-x divide-line text-center">
            <div className="px-2">
              <div className="flex items-center justify-center gap-1 text-2xl font-black">
                <TrendingUp className="h-5 w-5 text-accent" />
                {props.soldCount.toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-muted">transaksi sukses</div>
            </div>
            <div className="px-2">
              <div className="text-2xl font-black text-accent">{props.lowPrice != null ? rupiah(props.lowPrice) : "-"}</div>
              <div className="text-xs text-muted">harga mulai</div>
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-accent"><Headphones className="h-5 w-5" /></span>
          <div className="text-sm">
            <div className="font-bold">Butuh Bantuan?</div>
            <div className="text-xs text-muted">Simpan nomor invoice, CS kami siap 24 jam.</div>
          </div>
        </div>

        <div className="card p-4">
          {product ? (
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-3 border-b border-line pb-3">
                <Gem className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-bold">{product.name}</div>
                  {nick.state === "ok" && nick.for === accountKey && (
                    <div className="truncate text-xs text-success">{nick.text}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Harga</dt>
                <dd className="font-semibold">{rupiah(product.price)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Biaya {method ? `(${method.name})` : "layanan"}</dt>
                <dd className="font-semibold">{method ? rupiah(fee(product.price, method)) : "-"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-dashed border-line pt-3">
                <dt className="font-bold">Total</dt>
                <dd className="text-lg font-black text-accent">{total != null ? rupiah(total) : "-"}</dd>
              </div>
            </dl>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Belum ada item produk yang dipilih.</p>
          )}
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <button type="button" className="btn-primary w-full !rounded-xl !py-3.5 text-base" disabled={submitting} onClick={submit}>
          <ShoppingCart className="h-5 w-5" /> {submitting ? "Memproses…" : "Pesan Sekarang!"}
        </button>
      </aside>
    </div>
  );
}
