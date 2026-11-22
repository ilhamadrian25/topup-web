import { db } from "./db";

export type StoreSettings = {
  storeName: string;
  /** URL logo toko (kosong = logo bawaan). */
  logoUrl: string;
  tagline: string;
  /** Markup default (basis poin) di atas modal untuk harga jual biasa: 500 = 5%. */
  defaultMarginBps: number;
  /** Markup member default (basis poin) di atas modal untuk harga member login. */
  defaultMemberMarginBps: number;
  /** Interval sync produk otomatis dari biller (menit). 0 = mati. */
  autoSyncMinutes: number;
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
  defaultMemberMarginBps: 400,
  autoSyncMinutes: 15,
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
/** Markup efektif: harga jual biasa + harga member. */
export type Markups = { normal: Margin; member: Margin };

export type CategoryMarkupFields = { marginBps: number | null; marginFlat: number; memberMarginBps: number | null; memberMarginFlat: number };

/** Harga = modal + markup persen + markup tetap, dibulatkan ke atas ke kelipatan 100. */
export function applyMargin(basePrice: number, marginBps: number, marginFlat = 0): number {
  return Math.ceil(((basePrice * (10000 + marginBps)) / 10000 + marginFlat) / 100) * 100;
}

/** Markup efektif kategori: nilai persen kategori (null = default toko) + nilai tetap kategori. */
export function categoryMarkups(cat: CategoryMarkupFields, s: Pick<StoreSettings, "defaultMarginBps" | "defaultMemberMarginBps">): Markups {
  return {
    normal: { bps: cat.marginBps ?? s.defaultMarginBps, flat: cat.marginFlat },
    member: { bps: cat.memberMarginBps ?? s.defaultMemberMarginBps, flat: cat.memberMarginFlat },
  };
}

/**
 * Harga jual & harga member dari modal. Harga member null (= sama dengan harga biasa)
 * bila hasil markup member tidak lebih murah dari harga biasa.
 */
export function pricesFor(basePrice: number, m: Markups): { price: number; memberPrice: number | null } {
  const price = applyMargin(basePrice, m.normal.bps, m.normal.flat);
  const mp = applyMargin(basePrice, m.member.bps, m.member.flat);
  return { price, memberPrice: mp < price ? mp : null };
}
