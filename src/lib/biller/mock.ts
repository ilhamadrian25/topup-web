import type { AccountCheckResult, BillerAdapter, BillerProduct, BillerTxResult } from "./types";

/**
 * Mock biller Payterra (sampai API merchant Payterra tersedia).
 *  - checkAccount: ID utama bukan angka >= 5 digit, atau berakhiran "999" => tidak ditemukan.
 *  - purchase: ID utama berakhiran "000" => GAGAL; selain itu PENDING lalu
 *    SUKSES setelah ~8 detik. Idempoten per refId.
 */
const PROCESS_MS = 8_000;

type Brand = { code: string; name: string; items: [string, number][] };

const BRANDS: Brand[] = [
  { code: "MLBB", name: "Mobile Legends", items: [["5 Diamonds", 1_450], ["12 Diamonds", 3_400], ["28 Diamonds", 7_800], ["59 Diamonds", 15_900], ["85 Diamonds", 22_600], ["170 Diamonds", 45_000], ["257 Diamonds", 67_500], ["344 Diamonds", 90_300], ["514 Diamonds", 135_000], ["706 Diamonds", 182_000], ["Weekly Diamond Pass", 27_200], ["Twilight Pass", 141_000]] },
  { code: "FF", name: "Free Fire", items: [["5 Diamonds", 900], ["50 Diamonds", 7_100], ["70 Diamonds", 9_400], ["140 Diamonds", 18_700], ["355 Diamonds", 46_500], ["720 Diamonds", 93_000], ["1450 Diamonds", 186_000], ["Membership Mingguan", 28_600], ["Membership Bulanan", 85_000]] },
  { code: "PUBGM", name: "PUBG Mobile", items: [["60 UC", 14_200], ["325 UC", 70_500], ["660 UC", 140_000], ["1800 UC", 350_000], ["3850 UC", 700_000]] },
  { code: "GI", name: "Genshin Impact", items: [["60 Genesis Crystals", 14_300], ["300+30 Genesis Crystals", 72_000], ["980+110 Genesis Crystals", 222_000], ["Blessing of the Welkin Moon", 72_000]] },
  { code: "HSR", name: "Honkai: Star Rail", items: [["60 Oneiric Shard", 14_300], ["300+30 Oneiric Shard", 72_000], ["Express Supply Pass", 72_000]] },
  { code: "HOK", name: "Honor of Kings", items: [["16 Tokens", 3_000], ["80 Tokens", 14_500], ["240 Tokens", 43_000], ["400 Tokens", 71_500], ["800 Tokens", 143_000]] },
  { code: "VALO", name: "Valorant", items: [["475 VP", 52_000], ["1000 VP", 104_000], ["2050 VP", 208_000], ["3650 VP", 362_000]] },
  { code: "STEAM", name: "Steam Wallet (IDR)", items: [["Steam Wallet IDR 12.000", 12_500], ["Steam Wallet IDR 45.000", 46_000], ["Steam Wallet IDR 60.000", 61_000], ["Steam Wallet IDR 120.000", 121_500], ["Steam Wallet IDR 250.000", 252_000]] },
  { code: "GPLAY", name: "Google Play Voucher", items: [["Google Play Rp 20.000", 20_800], ["Google Play Rp 50.000", 51_000], ["Google Play Rp 100.000", 101_500]] },
];

const VOUCHER_BRANDS = new Set(["STEAM", "GPLAY"]);

const PRODUCTS: BillerProduct[] = BRANDS.flatMap((b) =>
  b.items.map(([name, price], i) => ({
    code: `${b.code}-${String(i + 1).padStart(2, "0")}`,
    brandCode: b.code,
    brandName: b.name,
    name,
    price,
    // Satu produk sengaja "gangguan" untuk menguji tampilan stok.
    available: !(b.code === "PUBGM" && i === 4),
  })),
);

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const ADJ = ["Swift", "Shadow", "Lucky", "Crimson", "Silent", "Brave", "Mystic", "Frost", "Neon", "Royal"];
const NOUN = ["Tiger", "Ranger", "Phoenix", "Wolf", "Knight", "Hunter", "Dragon", "Samurai", "Falcon", "Ghost"];

function primaryId(account: Record<string, string>): string {
  return Object.values(account)[0]?.trim() ?? "";
}

type Started = { at: number; productCode: string; account: Record<string, string> };
const g = globalThis as unknown as { mockBillerTx?: Map<string, Started> };
const started = (g.mockBillerTx ??= new Map());

function resolve(refId: string, s: Started): BillerTxResult {
  const billerRef = `PTR${s.at.toString(36).toUpperCase()}${(hash(refId) % 1e6).toString().padStart(6, "0")}`;
  const product = PRODUCTS.find((p) => p.code === s.productCode);
  if (!product) return { status: "FAILED", billerRef, message: "Produk tidak ditemukan di biller" };
  if (!product.available) return { status: "FAILED", billerRef, message: "Produk sedang gangguan" };
  if (!VOUCHER_BRANDS.has(product.brandCode) && primaryId(s.account).endsWith("000"))
    return { status: "FAILED", billerRef, message: "Transaksi ditolak operator (mock)", price: product.price };
  if (Date.now() - s.at < PROCESS_MS)
    return { status: "PENDING", billerRef, message: "Transaksi sedang diproses", price: product.price };
  const sn = VOUCHER_BRANDS.has(product.brandCode)
    ? Array.from({ length: 4 }, (_, i) => (hash(refId + i) % 0xffff).toString(16).toUpperCase().padStart(4, "0")).join("-")
    : hash(refId).toString().padStart(10, "0");
  return { status: "SUCCESS", billerRef, sn, message: "Transaksi sukses", price: product.price };
}

export class MockBiller implements BillerAdapter {
  readonly name = "mock";

  async listProducts() {
    return PRODUCTS;
  }

  async getBalance() {
    return 5_000_000;
  }

  async checkAccount({ brandCode, account }: { brandCode: string; account: Record<string, string> }): Promise<AccountCheckResult> {
    await new Promise((r) => setTimeout(r, 400));
    if (!BRANDS.some((b) => b.code === brandCode)) return { ok: false, message: "Game tidak didukung" };
    const id = primaryId(account);
    if (!/^\d{5,}$/.test(id) || id.endsWith("999")) return { ok: false, message: "Akun tidak ditemukan. Periksa kembali ID kamu." };
    const h = hash(JSON.stringify(account));
    return { ok: true, nickname: `${ADJ[h % ADJ.length]}${NOUN[(h >>> 4) % NOUN.length]}${h % 100}` };
  }

  async purchase({ refId, productCode, account }: { refId: string; productCode: string; account: Record<string, string> }) {
    let s = started.get(refId);
    if (!s) {
      s = { at: Date.now(), productCode, account };
      started.set(refId, s);
    }
    return resolve(refId, s);
  }

  async checkStatus({ refId }: { refId: string }): Promise<BillerTxResult> {
    const s = started.get(refId);
    // State hilang karena server restart: anggap sukses supaya order mock tidak menggantung.
    if (!s) return { status: "SUCCESS", message: "Transaksi sukses (mock)", sn: hash(refId).toString().padStart(10, "0") };
    return resolve(refId, s);
  }
}
