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
  /** Kontak usaha — ditampilkan di /contact, footer, S&K (syarat verifikasi payment gateway). */
  contactEmail: string;
  contactPhone: string;
  /** Nama usaha/badan hukum pengelola toko (kosong = pakai storeName). */
  businessName: string;
  businessAddress: string;
};

const DEFAULTS: StoreSettings = {
  storeName: "Topupin",
  logoUrl: "",
  tagline: "Top up game & voucher murah, cepat, otomatis 24 jam",
  defaultMarginBps: 500,
  memberDiscountBps: 100,
  whatsappCs: "",
  contactEmail: "",
  contactPhone: "",
  businessName: "",
  businessAddress: "",
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

export type Margin = { bps: number; flat: number };

/** Harga jual = modal + margin persen + margin tetap, dibulatkan ke atas ke kelipatan 100. */
export function applyMargin(basePrice: number, marginBps: number, marginFlat = 0): number {
  return Math.ceil(((basePrice * (10000 + marginBps)) / 10000 + marginFlat) / 100) * 100;
}

/** Harga member = harga jual − diskon member (dibulatkan ke bawah); null bila tidak di atas modal. */
export function memberPriceFor(price: number, basePrice: number, memberDiscountBps: number): number | null {
  if (memberDiscountBps <= 0) return null;
  const mp = Math.floor((price * (10000 - memberDiscountBps)) / 10000 / 100) * 100;
  return mp > basePrice ? mp : null;
}

/** Margin efektif kategori: marginBps kategori (null = default toko) + marginFlat kategori. */
export function categoryMargin(cat: { marginBps: number | null; marginFlat: number }, defaultMarginBps: number): Margin {
  return { bps: cat.marginBps ?? defaultMarginBps, flat: cat.marginFlat };
}
