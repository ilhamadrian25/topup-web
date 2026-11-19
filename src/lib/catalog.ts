import type { PrismaClient } from "@prisma/client";
import type { BillerAdapter } from "./biller/types";
import { applyMargin, categoryMargin, memberPriceFor } from "./settings";

export type SyncReport = {
  created: number;
  updated: number;
  repriced: { code: string; oldPrice: number; newPrice: number }[];
  unavailable: number;
  unknownBrands: string[];
};

/**
 * Tarik produk dari biller dan cocokkan ke Game lewat billerBrandCode.
 * - Produk baru: harga jual = modal + margin kategori (fallback margin default).
 * - Produk lama: harga jual admin dipertahankan, kecuali modal naik
 *   sampai >= harga jual (supaya tidak jual rugi) — dinaikkan ulang.
 * - Produk yang hilang dari biller: billerAvailable = false.
 */
export async function syncProducts(
  db: PrismaClient,
  biller: BillerAdapter,
  opts: { marginBps: number; memberDiscountBps: number },
): Promise<SyncReport> {
  const [items, games] = await Promise.all([biller.listProducts(), db.game.findMany({ include: { category: true } })]);
  const gameByBrand = new Map(games.map((g) => [g.billerBrandCode, g]));
  const existing = new Map((await db.product.findMany()).map((p) => [p.billerProductCode, p]));
  const priceFor = (basePrice: number, game: (typeof games)[number]) => {
    const m = categoryMargin(game.category, opts.marginBps);
    return applyMargin(basePrice, m.bps, m.flat);
  };

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
    const cur = existing.get(it.code);
    if (!cur) {
      const price = priceFor(it.price, game);
      await db.product.create({
        data: {
          gameId: game.id,
          name: it.name,
          billerProductCode: it.code,
          basePrice: it.price,
          price,
          memberPrice: memberPriceFor(price, it.price, opts.memberDiscountBps),
          billerAvailable: it.available,
          sortOrder: i,
        },
      });
      report.created++;
      continue;
    }
    let price = cur.price;
    let mp = cur.memberPrice;
    if (it.price >= cur.price) {
      price = priceFor(it.price, game);
      report.repriced.push({ code: it.code, oldPrice: cur.price, newPrice: price });
    }
    if (mp != null && mp <= it.price) mp = null;
    await db.product.update({
      where: { id: cur.id },
      data: { basePrice: it.price, billerAvailable: it.available, price, memberPrice: mp },
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
