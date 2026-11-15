import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { ChargeResult, CreateChargeInput, GatewayAdapter, GatewayStatus } from "./types";
import { GatewayError } from "./types";

/**
 * iPaymu API v2.
 * - Signature: HMAC-SHA256(apiKey, `POST:${va}:${sha256(body).lower}:${apiKey}`), hex lowercase.
 * - Header: va, signature, timestamp (YYYYMMDDhhmmss).
 * - Direct payment (/payment/direct) untuk va / qris / cstore; metode "redirect"
 *   memakai halaman bayar iPaymu (/payment) — dipakai untuk e-wallet.
 * - Callback tidak dipercaya: status selalu dicek ulang lewat /transaction.
 */
export type IpaymuConfig = { va: string; defaultEmail?: string };
export type IpaymuSecrets = { apiKey: string };

const BASE = {
  sandbox: "https://sandbox.ipaymu.com/api/v2",
  production: "https://my.ipaymu.com/api/v2",
};

/** Kode status transaksi iPaymu → status kita. 1/6/7 = berhasil (6 unsettled, 7 escrow). */
function mapStatus(code: number): GatewayStatus["status"] {
  if (code === 1 || code === 6 || code === 7) return "PAID";
  if (code === 0) return "PENDING";
  if (code === -2) return "EXPIRED";
  return "FAILED"; // 2 batal, 3 refund, 4 error, 5 gagal
}

/** Waktu WIB YYYYMMDDhhmmss. */
function timestamp(d = new Date()): string {
  const w = new Date(d.getTime() + 7 * 3600_000);
  return w.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

/** "2024-03-19 14:43:51" (WIB) → Date. */
function parseWib(s: unknown): Date | undefined {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return undefined;
  const d = new Date(s.replace(" ", "T") + "+07:00");
  return isNaN(d.getTime()) ? undefined : d;
}

const localPhone = (p: string) => (p.startsWith("62") ? "0" + p.slice(2) : p);

export class IpaymuGateway implements GatewayAdapter {
  private readonly base: string;
  constructor(
    private readonly cfg: IpaymuConfig,
    private readonly sec: IpaymuSecrets,
    sandbox: boolean,
  ) {
    this.base = sandbox ? BASE.sandbox : BASE.production;
  }

  private async call<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
    const { va } = this.cfg;
    const { apiKey } = this.sec;
    if (!va || !apiKey) throw new GatewayError("Kredensial iPaymu (VA / API key) belum diisi");
    // Jangan kirim null/undefined — iPaymu menolak signature-nya.
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v != null && v !== ""));
    const json = JSON.stringify(clean);
    const bodyHash = createHash("sha256").update(json).digest("hex").toLowerCase();
    const signature = createHmac("sha256", apiKey).update(`POST:${va}:${bodyHash}:${apiKey}`).digest("hex");

    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", va, signature, timestamp: timestamp() },
        body: json,
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (e) {
      throw new GatewayError(`iPaymu tidak bisa dihubungi: ${String(e)}`);
    }
    const data = (await res.json().catch(() => null)) as { Status?: number; Success?: boolean; Message?: string; Data?: T; Error?: unknown } | null;
    if (!res.ok || !data || data.Status !== 200) {
      const err = data?.Error ? ` ${JSON.stringify(data.Error)}` : "";
      throw new GatewayError(`iPaymu ${data?.Status ?? res.status}: ${data?.Message ?? res.statusText}${err}`, data);
    }
    return data.Data as T;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const { invoice, amount, method, customer, notifyUrl, returnUrl } = input;
    const minutes = Math.max(5, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000));
    const email = customer.email || this.cfg.defaultEmail || `noreply+${invoice.toLowerCase()}@example.com`;
    const pm = (method.gatewayMethod || "").toLowerCase();

    if (!pm || pm === "redirect") {
      const d = await this.call<{ SessionID?: string; Url?: string }>("/payment", {
        product: [`Top up ${invoice}`],
        qty: [1],
        price: [amount],
        description: [method.name],
        referenceId: invoice,
        notifyUrl,
        returnUrl,
        cancelUrl: returnUrl,
        buyerName: customer.name,
        buyerEmail: email,
        buyerPhone: localPhone(customer.phone),
        paymentMethod: method.gatewayChannel || undefined,
        expired: minutes,
        expiredType: "minutes",
        feeDirection: "MERCHANT",
        lang: "id",
      });
      if (!d?.Url) throw new GatewayError("iPaymu tidak mengembalikan URL pembayaran", d);
      return { paymentRef: null, paymentData: { type: "redirect", provider: method.name, url: d.Url } };
    }

    const d = await this.call<{
      TransactionId?: number | string;
      PaymentNo?: string;
      PaymentName?: string;
      QrString?: string;
      Total?: number;
      Expired?: string;
    }>("/payment/direct", {
      name: customer.name,
      phone: localPhone(customer.phone),
      email,
      amount,
      notifyUrl,
      referenceId: invoice,
      paymentMethod: pm,
      paymentChannel: method.gatewayChannel || undefined,
      expired: minutes,
      expiredType: "minutes",
      feeDirection: "MERCHANT",
      comments: `${method.name} ${invoice}`,
    });
    if (d?.TransactionId == null) throw new GatewayError("iPaymu tidak mengembalikan TransactionId", d);
    const no = String(d.PaymentNo ?? "");
    const paymentData: ChargeResult["paymentData"] =
      pm === "qris"
        ? { type: "qris", qrString: d.QrString || no }
        : pm === "cstore"
          ? { type: "retail", retailer: method.name, payCode: no }
          : { type: "va", bank: d.PaymentName || method.name, vaNumber: no };
    if (!no && !d.QrString) throw new GatewayError("iPaymu tidak mengembalikan nomor pembayaran", d);
    return { paymentRef: String(d.TransactionId), paymentData, expiresAt: parseWib(d.Expired) };
  }

  async checkStatus(transactionId: string): Promise<GatewayStatus> {
    const id = Number(transactionId);
    if (!Number.isSafeInteger(id)) throw new GatewayError("TransactionId iPaymu tidak valid");
    const d = await this.call<{ TransactionId?: number; ReferenceId?: string; Status?: number | string; Amount?: number | string }>(
      "/transaction",
      { transactionId: id, account: this.cfg.va },
    );
    const amount = d?.Amount != null && d.Amount !== "" ? Number(d.Amount) : null;
    return {
      status: mapStatus(Number(d?.Status)),
      transactionId: String(d?.TransactionId ?? id),
      referenceId: d?.ReferenceId ?? null,
      amount: Number.isFinite(amount) ? amount : null,
      raw: d,
    };
  }

  parseCallback(body: Record<string, unknown>) {
    const trx = String(body.trx_id ?? "").trim();
    const inv = String(body.reference_id ?? "").trim();
    return /^\d+$/.test(trx) && inv ? { transactionId: trx, invoice: inv } : null;
  }

  async testConnection() {
    const d = await this.call<{ Va?: string; MerchantBalance?: string | number }>("/balance", { account: this.cfg.va });
    return `Terhubung ke iPaymu (VA ${d?.Va ?? this.cfg.va}), saldo merchant Rp ${Number(d?.MerchantBalance ?? 0).toLocaleString("id-ID")}`;
  }
}
