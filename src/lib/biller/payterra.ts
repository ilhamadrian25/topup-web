import type { AccountCheckResult, BillerAdapter, BillerProduct, BillerTxResult } from "./types";

/**
 * Adapter ke API merchant Payterra. API-nya BELUM ADA di sisi Payterra;
 * endpoint di bawah adalah kontrak yang diusulkan (docs/payterra-merchant-api.md).
 * Sesuaikan begitu API merchant final.
 */
export class PayterraBiller implements BillerAdapter {
  readonly name = "payterra";
  private base = (process.env.PAYTERRA_BASE_URL ?? "").replace(/\/$/, "");
  private merchantId = process.env.PAYTERRA_MERCHANT_ID ?? "";
  private apiKey = process.env.PAYTERRA_API_KEY ?? "";

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.base || !this.apiKey) throw new Error("PAYTERRA_BASE_URL / PAYTERRA_API_KEY belum diset");
    const res = await fetch(this.base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Id": this.merchantId,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Payterra ${path} ${res.status}: ${json?.message ?? res.statusText}`);
    return (json.data ?? json) as T;
  }

  listProducts() {
    return this.call<BillerProduct[]>("GET", "/v1/merchant/products");
  }
  async getBalance() {
    return (await this.call<{ balance: number }>("GET", "/v1/merchant/balance")).balance;
  }
  checkAccount(input: { brandCode: string; account: Record<string, string> }) {
    return this.call<AccountCheckResult>("POST", "/v1/merchant/account-check", input);
  }
  purchase(input: { refId: string; productCode: string; account: Record<string, string> }) {
    return this.call<BillerTxResult>("POST", "/v1/merchant/transactions", input);
  }
  checkStatus({ refId }: { refId: string }) {
    return this.call<BillerTxResult>("GET", `/v1/merchant/transactions/${encodeURIComponent(refId)}`);
  }
}
