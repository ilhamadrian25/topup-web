/**
 * Tambah kategori E-Wallet + 5 brand saldo ke DB yang sudah berjalan (mis. production)
 * tanpa menyentuh data lain. Hanya membuat yang belum ada; tidak pernah meng-update.
 *
 *   npx tsx scripts/add-ewallet.ts          # dry run
 *   npx tsx scripts/add-ewallet.ts --apply  # tulis ke DB
 *
 * Setelah itu jalankan "Sync Produk" di admin supaya produknya masuk.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

const WALLETS = [
  ["dana", "DANA", "DANA Indonesia", "DANA", true, "/pay/dana.svg"],
  ["ovo", "OVO", "Visionet Internasional", "OVO", true, "/pay/ovo.svg"],
  ["gopay", "GoPay", "GoTo Financial", "GOPAY", true, "/games/gopay.svg"],
  ["shopeepay", "ShopeePay", "Shopee", "SHOPEEPAY", false, "/pay/shopeepay.svg"],
  ["linkaja", "LinkAja", "Fintek Karya Nusantara", "LINKAJA", false, "/games/linkaja.svg"],
] as const;

async function main() {
  let cat = await db.category.findUnique({ where: { slug: "ewallet" } });
  if (cat) console.log(`= kategori ewallet sudah ada (margin ${cat.marginBps ?? "default"} bps + Rp ${cat.marginFlat})`);
  else {
    console.log("+ kategori E-Wallet (0% + Rp 500)");
    if (apply) {
      const last = await db.category.aggregate({ _max: { sortOrder: true } });
      cat = await db.category.create({
        data: { slug: "ewallet", name: "E-Wallet", sortOrder: (last._max.sortOrder ?? 0) + 1, marginBps: 0, marginFlat: 500 },
      });
    }
  }

  const lastGame = await db.game.aggregate({ _max: { sortOrder: true } });
  let order = (lastGame._max.sortOrder ?? 0) + 1;
  for (const [slug, name, publisher, brand, popular, imageUrl] of WALLETS) {
    const s = `saldo-${slug}`;
    const clash = await db.game.findFirst({ where: { OR: [{ slug: s }, { billerBrandCode: brand }] } });
    if (clash) {
      console.log(`= ${s}: sudah ada (${clash.slug}, brand ${clash.billerBrandCode}) — dilewati`);
      continue;
    }
    console.log(`+ ${s} (brand ${brand})`);
    if (!apply || !cat) continue;
    await db.game.create({
      data: {
        slug: s, name: `Saldo ${name}`, publisher, billerBrandCode: brand, categoryId: cat.id,
        inputFields: [{ key: "phone", label: `Nomor HP ${name}`, placeholder: "Contoh: 081234567890" }],
        inputHint: `Masukkan nomor HP yang terdaftar di ${name}. Pastikan nama pemilik akun sesuai sebelum membayar — saldo yang sudah masuk tidak bisa ditarik kembali.`,
        nicknameCheck: true, isPopular: popular, sortOrder: order++, imageUrl,
      },
    });
  }
  console.log(apply ? "Selesai." : "Dry run — jalankan dengan --apply untuk menulis.");
}

main().finally(() => db.$disconnect());
