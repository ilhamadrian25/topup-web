import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { AccountCheckResult, BillerAdapter, BillerProduct, BillerTxResult } from "./types";

/**
 * Payterra Open API v1 (partner API) — https://openapi.payterra.id, docs: open-api-service docs/API.md.
 *
 * Credentials come from the Biller menu in admin (BillerAccount, encrypted): API key id `pk_…`, API secret,
 * webhook secret — all from the Payterra partner dashboard. Legacy fallback when no BillerAccount is active:
 * env PAYTERRA_BASE_URL / PAYTERRA_API_KEY / PAYTERRA_API_SECRET / PAYTERRA_CALLBACK_SECRET.
 *
 * Status rules (the order flow depends on them):
 *  - A definitive rejection (the API answers with an error and nothing was charged) → FAILED.
 *  - Timeouts, network errors and unexpected answers throw, so the order stays PROCESSING and is
 *    settled by checkStatus/callback. Retrying with the same ref_id never charges twice.
 */

type Envelope<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

type OaProduct = {
  code: string;
  name: string;
  type: string;
  brand: { code: string; name: string };
  available: boolean;
  customer_inputs?: { key: string; label: string }[];
  prepaid?: { price: number };
};

type OaTransaction = {
  ref_id: string;
  trx_id?: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount?: { total?: number };
  prepaid?: { sn?: string };
  message?: string;
};

/** Error answered by the API (as opposed to a transport failure). */
export class PayterraApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(`Payterra ${status} ${code}: ${message}`);
  }
}

/** Codes that mean "rejected before anything was charged" for POST /v1/transactions (docs/API.md). */
const DEFINITIVE_REJECTIONS = new Set([
  "INSUFFICIENT_BALANCE",
  "PRICE_CHANGED",
  "PRODUCT_NOT_AVAILABLE",
  "UNSUPPORTED_PRODUCT",
  "CUSTOMER_NOT_FOUND",
  "LIMIT_EXCEEDED",
  "PARTNER_SUSPENDED",
  "INVALID_INPUT",
  "UPSTREAM_UNAVAILABLE",
]);

const MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: "Saldo deposit Payterra tidak cukup",
  PRICE_CHANGED: "Harga modal berubah — jalankan Sync Produk lalu coba lagi",
  PRODUCT_NOT_AVAILABLE: "Produk sedang tidak tersedia",
  CUSTOMER_NOT_FOUND: "Akun tujuan tidak ditemukan",
  PARTNER_SUSPENDED: "Akun partner Payterra disuspend",
  UPSTREAM_UNAVAILABLE: "Supplier sedang gangguan, belum ada saldo yang terpotong",
};

const PRODUCTS_TTL_MS = 60_000;

export const PAYTERRA_DEFAULT_BASE_URL = "https://openapi.payterra.id";

export type PayterraCredentials = { baseUrl?: string; apiKey: string; apiSecret: string };

export class PayterraBiller implements BillerAdapter {
  readonly name = "payterra";
  private base: string;
  private keyId: string;
  private secret: string;
  private products: { at: number; items: OaProduct[] } | null = null;

  constructor(creds?: PayterraCredentials) {
    const c = creds ?? {
      baseUrl: process.env.PAYTERRA_BASE_URL,
      apiKey: process.env.PAYTERRA_API_KEY ?? "",
      apiSecret: process.env.PAYTERRA_API_SECRET ?? "",
    };
    this.base = (c.baseUrl || PAYTERRA_DEFAULT_BASE_URL).replace(/\/$/, "");
    this.keyId = c.apiKey;
    this.secret = c.apiSecret;
  }

  private async call<T>(method: "GET" | "POST", uri: string, body?: unknown): Promise<T> {
    if (!this.keyId || !this.secret) throw new Error("API Key / API Secret Payterra belum diisi (menu Biller)");
    const raw = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const bodyHash = createHash("sha256").update(raw).digest("hex");
    const signature = createHmac("sha256", this.secret).update([method, uri, ts, nonce, bodyHash].join("\n")).digest("hex");
    const res = await fetch(this.base + uri, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": this.keyId,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": signature,
      },
      body: raw || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const env = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!env) throw new Error(`Payterra ${uri}: HTTP ${res.status}, respons tidak bisa dibaca`);
    if (!env.success) throw new PayterraApiError(res.status, env.error?.code ?? "ERROR", env.error?.message ?? res.statusText, env.data);
    return env.data as T;
  }

  private async catalog(force = false): Promise<OaProduct[]> {
    if (!force && this.products && Date.now() - this.products.at < PRODUCTS_TTL_MS) return this.products.items;
    const { items } = await this.call<{ items: OaProduct[] }>("GET", "/v1/products");
    this.products = { at: Date.now(), items: items ?? [] };
    return this.products.items;
  }

  /** topup-web keeps account fields in the game's input order; the API wants customer_no, customer_no_2, … */
  private customerFields(product: OaProduct | undefined, account: Record<string, string>): Record<string, string> {
    const values = Object.values(account).map((v) => String(v ?? "").trim());
    const keys = product?.customer_inputs?.length
      ? product.customer_inputs.map((i) => i.key)
      : values.map((_, i) => (i === 0 ? "customer_no" : `customer_no_${i + 1}`));
    return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? ""]));
  }

  async listProducts(): Promise<BillerProduct[]> {
    const items = await this.catalog(true);
    return items
      .filter((p) => p.type === "prepaid" && p.prepaid)
      .map((p) => ({
        code: p.code,
        brandCode: p.brand.code,
        brandName: p.brand.name,
        name: p.name,
        price: p.prepaid!.price,
        available: p.available,
      }));
  }

  async getBalance(): Promise<number> {
    return (await this.call<{ available: number }>("GET", "/v1/balance")).available;
  }

  async checkAccount({ brandCode, account }: { brandCode: string; account: Record<string, string> }): Promise<AccountCheckResult> {
    const items = await this.catalog();
    const product = items.find((p) => p.brand.code === brandCode && p.available) ?? items.find((p) => p.brand.code === brandCode);
    if (!product) return { ok: false, message: "Produk untuk game ini belum tersedia" };
    try {
      const r = await this.call<{ customer?: { name?: string } }>("POST", "/v1/inquiry", {
        product_code: product.code,
        ...this.customerFields(product, account),
      });
      return { ok: true, nickname: r.customer?.name?.trim() || "(nama tidak tersedia)" };
    } catch (e) {
      if (e instanceof PayterraApiError && (e.code === "CUSTOMER_NOT_FOUND" || e.code === "INVALID_INPUT"))
        return { ok: false, message: "Akun tidak ditemukan. Periksa kembali ID kamu." };
      throw e;
    }
  }

  async purchase({ refId, productCode, account }: { refId: string; productCode: string; account: Record<string, string> }): Promise<BillerTxResult> {
    const product = (await this.catalog()).find((p) => p.code === productCode);
    if (!product?.prepaid) return { status: "FAILED", message: "Produk tidak ada di katalog Payterra" };
    try {
      const tx = await this.call<OaTransaction>("POST", "/v1/transactions", {
        ref_id: refId,
        product_code: productCode,
        ...this.customerFields(product, account),
        price: product.prepaid.price,
      });
      return toResult(tx);
    } catch (e) {
      if (e instanceof PayterraApiError && DEFINITIVE_REJECTIONS.has(e.code)) {
        if (e.code === "PRICE_CHANGED") this.products = null;
        const tx = e.data as OaTransaction | undefined;
        return { status: "FAILED", billerRef: tx?.trx_id, message: MESSAGES[e.code] ?? e.message };
      }
      throw e; // uncertain → order stays PROCESSING, settled by checkStatus/callback
    }
  }

  async checkStatus({ refId }: { refId: string }): Promise<BillerTxResult> {
    try {
      return toResult(await this.call<OaTransaction>("GET", `/v1/transactions/${encodeURIComponent(refId)}`));
    } catch (e) {
      // open-api stores the row before calling the supplier, so "not found" means the request never landed.
      if (e instanceof PayterraApiError && e.status === 404)
        return { status: "FAILED", message: "Transaksi tidak tercatat di Payterra (tidak ada saldo terpotong)" };
      throw e;
    }
  }
}

export function toResult(tx: OaTransaction): BillerTxResult {
  return {
    status: tx.status,
    billerRef: tx.trx_id,
    sn: tx.prepaid?.sn || undefined,
    message: tx.message || (tx.status === "SUCCESS" ? "Transaksi sukses" : tx.status === "PENDING" ? "Transaksi sedang diproses" : "Transaksi gagal"),
    price: tx.amount?.total,
  };
}
