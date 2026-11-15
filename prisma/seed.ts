import { PrismaClient, type PaymentGroup } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MockBiller } from "../src/lib/biller/mock";
import { syncProducts } from "../src/lib/catalog";

const db = new PrismaClient();

const id = (key: string, label: string, placeholder?: string) => ({ key, label, placeholder });

const GAMES = [
  { slug: "mobile-legends", name: "Mobile Legends", publisher: "Moonton", brand: "MLBB", cat: "game", popular: true, nick: true,
    fields: [id("userId", "User ID", "Contoh: 12345678"), id("zoneId", "Zone ID", "Contoh: 1234")],
    hint: "Buka profil di dalam game. User ID dan Zone ID ada di bawah nama karakter, contoh 12345678 (1234)." },
  { slug: "free-fire", name: "Free Fire", publisher: "Garena", brand: "FF", cat: "game", popular: true, nick: true,
    fields: [id("userId", "Player ID", "Contoh: 123456789")], hint: "Player ID ada di halaman profil, di bawah nickname." },
  { slug: "pubg-mobile", name: "PUBG Mobile", publisher: "Tencent", brand: "PUBGM", cat: "game", popular: true, nick: true,
    fields: [id("userId", "Character ID", "Contoh: 5123456789")], hint: "Character ID ada di pojok kanan atas lobby." },
  { slug: "genshin-impact", name: "Genshin Impact", publisher: "HoYoverse", brand: "GI", cat: "game", popular: true, nick: true,
    fields: [
      id("uid", "UID", "Contoh: 812345678"),
      { key: "server", label: "Server", options: [
        { value: "os_asia", label: "Asia" }, { value: "os_usa", label: "America" },
        { value: "os_euro", label: "Europe" }, { value: "os_cht", label: "TW, HK, MO" },
      ] },
    ], hint: "UID tampil di pojok kanan bawah layar saat bermain." },
  { slug: "honkai-star-rail", name: "Honkai: Star Rail", publisher: "HoYoverse", brand: "HSR", cat: "game", popular: false, nick: true,
    fields: [
      id("uid", "UID", "Contoh: 812345678"),
      { key: "server", label: "Server", options: [
        { value: "prod_official_asia", label: "Asia" }, { value: "prod_official_usa", label: "America" },
        { value: "prod_official_eur", label: "Europe" }, { value: "prod_official_cht", label: "TW, HK, MO" },
      ] },
    ], hint: "UID ada di menu Phone > profil." },
  { slug: "honor-of-kings", name: "Honor of Kings", publisher: "Level Infinite", brand: "HOK", cat: "game", popular: true, nick: true,
    fields: [id("userId", "Player ID", "Contoh: 1234567890123")], hint: "Player ID ada di halaman profil." },
  { slug: "valorant", name: "Valorant", publisher: "Riot Games", brand: "VALO", cat: "game", popular: false, nick: true,
    fields: [id("userId", "Riot ID", "Contoh: 12345678")], hint: "Masukkan Riot ID akun region Indonesia." },
  { slug: "steam-wallet", name: "Steam Wallet (IDR)", publisher: "Valve", brand: "STEAM", cat: "voucher", popular: false, nick: false,
    fields: [], hint: "Kode voucher akan tampil di halaman invoice setelah pembayaran berhasil." },
  { slug: "google-play", name: "Google Play Voucher", publisher: "Google", brand: "GPLAY", cat: "voucher", popular: false, nick: false,
    fields: [], hint: "Kode voucher akan tampil di halaman invoice setelah pembayaran berhasil." },
];

const GAME_IMAGE: Record<string, string> = {
  "google-play": "/games/google-play.svg",
  valorant: "/games/valorant.svg",
};
const imageFor = (slug: string) => GAME_IMAGE[slug] ?? `/games/${slug}.jpg`;

const PAY_LOGO: Record<string, string> = {
  QRIS: "/pay/qris.svg", DANA: "/pay/dana.svg", OVO: "/pay/ovo.svg", SHOPEEPAY: "/pay/shopeepay.svg",
  BCAVA: "/pay/bca.svg", BRIVA: "/pay/bri.svg", MANDIRIVA: "/pay/mandiri.svg", ALFAMART: "/pay/alfamart.svg",
};

const METHODS: { code: string; name: string; group: PaymentGroup; feeFlat: number; feeBps: number; min?: number; max?: number }[] = [
  { code: "QRIS", name: "QRIS", group: "QRIS", feeFlat: 0, feeBps: 70, min: 1_000, max: 10_000_000 },
  { code: "DANA", name: "DANA", group: "EWALLET", feeFlat: 0, feeBps: 150, min: 1_000 },
  { code: "OVO", name: "OVO", group: "EWALLET", feeFlat: 0, feeBps: 150, min: 10_000 },
  { code: "SHOPEEPAY", name: "ShopeePay", group: "EWALLET", feeFlat: 0, feeBps: 200, min: 1_000 },
  { code: "BCAVA", name: "BCA Virtual Account", group: "VIRTUAL_ACCOUNT", feeFlat: 4_000, feeBps: 0, min: 10_000 },
  { code: "BRIVA", name: "BRI Virtual Account", group: "VIRTUAL_ACCOUNT", feeFlat: 3_500, feeBps: 0, min: 10_000 },
  { code: "MANDIRIVA", name: "Mandiri Virtual Account", group: "VIRTUAL_ACCOUNT", feeFlat: 4_000, feeBps: 0, min: 10_000 },
  { code: "ALFAMART", name: "Alfamart", group: "RETAIL", feeFlat: 5_000, feeBps: 0, min: 10_000, max: 2_500_000 },
];

/** paymentMethod / paymentChannel iPaymu per metode. E-wallet lewat halaman bayar iPaymu (redirect). */
const IPAYMU_MAP: Record<string, [string, string | null]> = {
  QRIS: ["qris", "mpm"],
  DANA: ["redirect", null],
  OVO: ["redirect", null],
  SHOPEEPAY: ["redirect", null],
  BCAVA: ["va", "bca"],
  BRIVA: ["va", "bri"],
  MANDIRIVA: ["va", "mandiri"],
  ALFAMART: ["cstore", "alfamart"],
};

async function main() {
  const cats = {
    game: await db.category.upsert({ where: { slug: "game" }, update: {}, create: { slug: "game", name: "Top Up Game", sortOrder: 0 } }),
    voucher: await db.category.upsert({ where: { slug: "voucher" }, update: {}, create: { slug: "voucher", name: "Voucher", sortOrder: 1 } }),
  };

  for (const [i, g] of GAMES.entries()) {
    const data = {
      name: g.name, publisher: g.publisher, categoryId: cats[g.cat as keyof typeof cats].id, billerBrandCode: g.brand,
      inputFields: g.fields, inputHint: g.hint, nicknameCheck: g.nick, isPopular: g.popular, sortOrder: i,
      imageUrl: imageFor(g.slug),
    };
    await db.game.upsert({ where: { slug: g.slug }, update: data, create: { slug: g.slug, ...data } });
  }

  // Gateway: mock aktif untuk development; iPaymu sandbox disiapkan nonaktif (isi VA + API key di admin).
  const mockGw = await db.paymentGateway.upsert({
    where: { code: "mock" },
    update: {},
    create: { code: "mock", name: "Mock (development)", provider: "MOCK", isSandbox: true, isActive: true },
  });
  await db.paymentGateway.upsert({
    where: { code: "ipaymu-sandbox" },
    update: {},
    create: { code: "ipaymu-sandbox", name: "iPaymu Sandbox", provider: "IPAYMU", isSandbox: true, isActive: false, config: { va: "", defaultEmail: "" } },
  });

  for (const [i, m] of METHODS.entries()) {
    const data = { name: m.name, group: m.group, feeFlat: m.feeFlat, feeBps: m.feeBps, minAmount: m.min ?? 0, maxAmount: m.max ?? null, sortOrder: i, imageUrl: PAY_LOGO[m.code] ?? null };
    await db.paymentMethod.upsert({ where: { code: m.code }, update: data, create: { code: m.code, ...data } });
    // Pemetaan ke iPaymu; hanya diisi kalau admin belum mengaturnya.
    const [gatewayMethod, gatewayChannel] = IPAYMU_MAP[m.code] ?? [null, null];
    await db.paymentMethod.updateMany({ where: { code: m.code, gatewayId: null }, data: { gatewayId: mockGw.id } });
    await db.paymentMethod.updateMany({ where: { code: m.code, gatewayMethod: null }, data: { gatewayMethod, gatewayChannel } });
  }

  if ((await db.banner.count()) === 0) {
    await db.banner.createMany({
      data: [
        { title: "Top up instan 24/7", subtitle: "Diamond masuk dalam hitungan detik setelah bayar", linkUrl: "/games/mobile-legends", sortOrder: 0 },
        { title: "Harga member lebih murah", subtitle: "Daftar gratis dan hemat di setiap transaksi", linkUrl: "/register", sortOrder: 1 },
        { title: "Bayar pakai QRIS", subtitle: "Semua e-wallet & m-banking, biaya paling rendah", linkUrl: "/games/free-fire", sortOrder: 2 },
      ],
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@topup.local";
  const pw = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(pw, 10) },
  });

  const report = await syncProducts(db, new MockBiller(), { marginBps: 500, memberDiscountBps: 100 });
  console.log("Seed selesai.", { admin: email, sync: { created: report.created, updated: report.updated } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
