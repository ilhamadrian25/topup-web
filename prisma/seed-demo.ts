/**
 * Data transaksi DEMO untuk development (mengisi dashboard). Jangan jalankan di produksi.
 *   npm run db:seed-demo            # tambah ~250 order acak 30 hari terakhir
 *   npm run db:seed-demo -- --clear # hapus semua order demo
 * Order demo ditandai invoice berawalan "DEMO".
 */
import { PrismaClient, type FulfillmentStatus, type PaymentStatus } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Tidak boleh di produksi");
  const del = await db.order.deleteMany({ where: { invoice: { startsWith: "DEMO" } } });
  if (process.argv.includes("--clear")) {
    console.log(`Dihapus ${del.count} order demo.`);
    return;
  }

  const [products, methods, members] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, include: { game: true } }),
    db.paymentMethod.findMany({ where: { isActive: true } }),
    db.user.findMany({ where: { role: "MEMBER" }, select: { id: true } }),
  ]);
  if (!products.length || !methods.length) throw new Error("Jalankan db:seed dulu");

  // Bobot: game populer & nominal kecil lebih sering dibeli; QRIS paling sering.
  const weighted = products.flatMap((p) => Array(p.game.isPopular ? (p.basePrice < 50_000 ? 6 : 3) : 1).fill(p));
  const methodPool = methods.flatMap((m) => Array(m.code === "QRIS" ? 6 : m.group === "EWALLET" ? 3 : 1).fill(m));
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

  const rows = [];
  for (let i = 0; i < 250; i++) {
    const daysAgo = Math.floor(Math.random() ** 1.4 * 30); // lebih padat di hari-hari terakhir
    const at = new Date(Date.now() - daysAgo * 86_400_000 - Math.random() * 86_400_000 * (daysAgo ? 1 : 0.5));
    const p = pick(weighted);
    const m = pick(methodPool);
    const member = members.length && Math.random() < 0.3 ? pick(members) : null;
    const price = member && p.memberPrice ? p.memberPrice : p.price;
    const fee = m.feeFlat + Math.ceil((price * m.feeBps) / 10000);
    const r = Math.random();
    const [pay, ful]: [PaymentStatus, FulfillmentStatus] =
      r < 0.78 ? ["PAID", "SUCCESS"] : r < 0.82 ? ["PAID", "FAILED"] : r < 0.84 ? ["PAID", "REFUNDED"] : r < 0.95 ? ["EXPIRED", "WAITING"] : ["UNPAID", "WAITING"];
    rows.push({
      invoice: `DEMO${at.getTime().toString(36).toUpperCase()}${i}`,
      userId: member?.id ?? null,
      gameId: p.gameId,
      productId: p.id,
      productName: p.name,
      accountData: { userId: String(10_000_000 + Math.floor(Math.random() * 9e7)) },
      contactPhone: `62800000${String(i).padStart(4, "0")}`,
      price,
      fee,
      total: price + fee,
      basePrice: p.basePrice,
      paymentMethodId: m.id,
      paymentStatus: pay,
      fulfillmentStatus: ful,
      paidAt: pay === "PAID" ? at : null,
      fulfilledAt: ful === "SUCCESS" ? at : null,
      billerMessage: ful === "FAILED" ? "Transaksi ditolak operator (demo)" : null,
      // Demo UNPAID dibuat sudah lewat batas supaya tidak ikut "perlu dibayar".
      expiresAt: new Date(at.getTime() + 3_600_000),
      createdAt: at,
    });
  }
  await db.order.createMany({ data: rows });
  console.log(`Dibuat ${rows.length} order demo (hapus: npm run db:seed-demo -- --clear).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
