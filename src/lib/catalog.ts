import type { PrismaClient } from "@prisma/client";
import type { BillerAdapter } from "./biller/types";
import { categoryMarkups, pricesFor, type StoreSettings } from "./settings";

export type SyncReport = {
  created: number;
  updated: number;
  repriced: { code: string; oldPrice: number; newPrice: number }[];
  unavailable: number;
  unknownBrands: string[];
};

export type MarkupDefaults = Pick<StoreSettings, "defaultMarginBps" | "defaultMemberMarginBps">;

/**
 * Tarik produk dari biller dan cocokkan ke Game lewat billerBrandCode.
 * Harga jual & harga member selalu = modal terbaru + markup kategori (markup biasa / markup member),
 * jadi ikut naik/turun mengikuti harga Payterra. Produk yang hilang dari biller: billerAvailable = false.
 * Baris yang tidak berubah tidak ditulis ulang (sync dijalankan berkala).
 */
export async function syncProducts(db: PrismaClient, biller: BillerAdapter, defaults: MarkupDefaults): Promise<SyncReport> {
  const [items, games] = await Promise.all([biller.listProducts(), db.game.findMany({ include: { category: true } })]);
  const gameByBrand = new Map(games.map((g) => [g.billerBrandCode, g]));
  const existing = new Map((await db.product.findMany()).map((p) => [p.billerProductCode, p]));

  const report: SyncReport = { created: 0, updated: 0, repriced: [], unavailable: 0, unknownBrands: [] };
  const seen = new Set<string>();
  const unknown = new Set<string>();

  for (const [i, it] of items.entries()) {
    const game = gameByBrand.get(it.brandCode);
    if (!game) {
      unknown.add(`${it.brandCode} (${it.brandName})`);
      continue;
    }
    seen.add(it.code);
    const { price, memberPrice } = pricesFor(it.price, categoryMarkups(game.category, defaults));
    const cur = existing.get(it.code);
    if (!cur) {
      await db.product.create({
        data: { gameId: game.id, name: it.name, billerProductCode: it.code, basePrice: it.price, price, memberPrice, billerAvailable: it.available, sortOrder: i },
      });
      report.created++;
      continue;
    }
    if (price !== cur.price) report.repriced.push({ code: it.code, oldPrice: cur.price, newPrice: price });
    if (price === cur.price && memberPrice === cur.memberPrice && it.price === cur.basePrice && it.available === cur.billerAvailable) continue;
    await db.product.update({
      where: { id: cur.id },
      data: { basePrice: it.price, billerAvailable: it.available, price, memberPrice },
    });
    report.updated++;
  }

  const gone = [...existing.values()].filter((p) => !seen.has(p.billerProductCode) && p.billerAvailable);
  if (gone.length) {
    await db.product.updateMany({ where: { id: { in: gone.map((p) => p.id) } }, data: { billerAvailable: false } });
    report.unavailable = gone.length;
  }
  report.unknownBrands = [...unknown];
  return report;
}

/** Hitung ulang harga semua produk dari modal yang tersimpan (tanpa memanggil biller), mis. setelah markup diubah. */
export async function repriceFromBase(db: PrismaClient, defaults: MarkupDefaults, where: { game?: { categoryId: string } } = {}): Promise<number> {
  const products = await db.product.findMany({ where, include: { game: { include: { category: true } } } });
  const changed = products
    .map((p) => ({ p, next: pricesFor(p.basePrice, categoryMarkups(p.game.category, defaults)) }))
    .filter(({ p, next }) => next.price !== p.price || next.memberPrice !== p.memberPrice);
  await db.$transaction(changed.map(({ p, next }) => db.product.update({ where: { id: p.id }, data: next })));
  return changed.length;
}
