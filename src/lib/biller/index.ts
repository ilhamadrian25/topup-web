import "server-only";
import type { BillerAccount, BillerProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/secrets";
import { MockBiller } from "./mock";
import { PAYTERRA_DEFAULT_BASE_URL, PayterraBiller } from "./payterra";
import type { BillerAdapter } from "./types";

export type * from "./types";

/**
 * Provider yang didukung kode. Akunnya (kredensial, aktif) diatur di tabel
 * BillerAccount lewat menu admin "Biller". Menambah biller baru = tambah enum
 * BillerProvider + adapter + entri di sini.
 */
export const BILLER_PROVIDERS: Record<
  BillerProvider,
  {
    label: string;
    configFields: { key: string; label: string; placeholder?: string }[];
    secretFields: { key: string; label: string }[];
    /** Field yang wajib terisi sebelum akun boleh diaktifkan. */
    required: string[];
  }
> = {
  PAYTERRA: {
    label: "Payterra Open API",
    configFields: [{ key: "baseUrl", label: "Base URL", placeholder: PAYTERRA_DEFAULT_BASE_URL }],
    secretFields: [
      { key: "apiKey", label: "API Key (pk_…)" },
      { key: "apiSecret", label: "API Secret" },
      { key: "webhookSecret", label: "Webhook Secret" },
    ],
    required: ["apiKey", "apiSecret", "webhookSecret"],
  },
  MOCK: { label: "Mock (development)", configFields: [], secretFields: [], required: [] },
};

type AccountLike = Pick<BillerAccount, "id" | "provider" | "config" | "secrets" | "updatedAt">;

const g = globalThis as unknown as { billerCache?: Map<string, BillerAdapter>; legacyBiller?: BillerAdapter };

/**
 * Adapter per akun, di-cache per (id, updatedAt) supaya cache katalog Payterra
 * bertahan antar request, dan otomatis dibuat ulang setelah akun disimpan.
 */
export function billerAdapter(acc: AccountLike): BillerAdapter {
  const cache = (g.billerCache ??= new Map());
  const key = `${acc.id}:${acc.updatedAt.getTime()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let adapter: BillerAdapter;
  switch (acc.provider) {
    case "PAYTERRA": {
      const cfg = (acc.config ?? {}) as { baseUrl?: string };
      const sec = decryptJson(acc.secrets);
      adapter = new PayterraBiller({ baseUrl: cfg.baseUrl, apiKey: sec.apiKey ?? "", apiSecret: sec.apiSecret ?? "" });
      break;
    }
    case "MOCK":
      adapter = new MockBiller();
      break;
  }
  for (const k of cache.keys()) if (k.startsWith(`${acc.id}:`)) cache.delete(k);
  cache.set(key, adapter);
  return adapter;
}

/** Biller dari env, dipakai selama belum ada akun Biller yang aktif (perilaku lama). */
function legacyBiller(): BillerAdapter {
  return (g.legacyBiller ??= process.env.BILLER_PROVIDER === "payterra" ? new PayterraBiller() : new MockBiller());
}

export type ResolvedBiller = { account: BillerAccount | null; adapter: BillerAdapter };

/** Biller untuk order baru, cek akun, sync produk, dan saldo. */
export async function activeBiller(): Promise<ResolvedBiller> {
  const account = await db.billerAccount.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  return account ? { account, adapter: billerAdapter(account) } : { account: null, adapter: legacyBiller() };
}

/** Biller yang memproses order ini (tetap dipakai walau biller aktif sudah diganti). */
export async function billerForOrder(order: { billerAccountId: string | null }): Promise<ResolvedBiller> {
  if (order.billerAccountId) {
    const account = await db.billerAccount.findUnique({ where: { id: order.billerAccountId } });
    if (account) return { account, adapter: billerAdapter(account) };
  }
  return activeBiller();
}

/** Label untuk tampilan admin. */
export function billerLabel(r: ResolvedBiller): string {
  if (r.account) return `${r.account.name} (${BILLER_PROVIDERS[r.account.provider].label})`;
  return r.adapter.name === "mock" ? "Mock (env, belum ada biller aktif)" : "Payterra (env)";
}
