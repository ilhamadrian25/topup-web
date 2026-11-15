import { db } from "./db";

export type StoreSettings = {
  storeName: string;
  /** URL logo toko (kosong = logo bawaan). */
  logoUrl: string;
  tagline: string;
  /** Margin default (basis poin) saat sync produk baru: 500 = 5%. */
  defaultMarginBps: number;
  /** Diskon member dari harga jual (basis poin). 0 = tanpa harga member. */
  memberDiscountBps: number;
  whatsappCs: string;
};

const DEFAULTS: StoreSettings = {
  storeName: "Payterra Top Up",
  logoUrl: "",
  tagline: "Top up game & voucher murah, cepat, otomatis 24 jam",
  defaultMarginBps: 500,
  memberDiscountBps: 100,
  whatsappCs: "",
};

export async function getSettings(): Promise<StoreSettings> {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULTS) out[r.key] = r.value;
  return out as StoreSettings;
}

export async function saveSettings(patch: Partial<StoreSettings>) {
  await db.$transaction(
    Object.entries(patch).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      }),
    ),
  );
}

/** Harga jual = modal + margin, dibulatkan ke atas ke kelipatan 100. */
export function applyMargin(basePrice: number, marginBps: number): number {
  return Math.ceil((basePrice * (10000 + marginBps)) / 10000 / 100) * 100;
}
