import type { PrismaClient } from "@prisma/client";
import type { BillerAdapter } from "./biller/types";
import { applyMargin } from "./settings";

export type SyncReport = {
  created: number;
  updated: number;
  repriced: { code: string; oldPrice: number; newPrice: number }[];
  unavailable: number;
  unknownBrands: string[];
};

/**
 * Tarik produk dari biller dan cocokkan ke Game lewat billerBrandCode.
 * - Produk baru: harga jual = modal + margin default.
 * - Produk lama: harga jual admin dipertahankan, kecuali modal naik
 *   sampai >= harga jual (supaya tidak jual rugi) — dinaikkan ulang.
 * - Produk yang hilang dari biller: billerAvailable = false.
 */
export async function syncProducts(
  db: PrismaClient,
  biller: BillerAdapter,
  opts: { marginBps: number; memberDiscountBps: number },
): Promise<SyncReport> {
  const [items, games] = await Promise.all([biller.listProducts(), db.game.findMany()]);
  const gameByBrand = new Map(games.map((g) => [g.billerBrandCode, g]));
  const existing = new Map((await db.product.findMany()).map((p) => [p.billerProductCode, p]));
  const memberPrice = (price: number) =>
    opts.memberDiscountBps > 0 ? Math.floor((price * (10000 - opts.memberDiscountBps)) / 10000 / 100) * 100 : null;

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
      const price = applyMargin(it.price, opts.marginBps);
      const mp = memberPrice(price);
      await db.product.create({
        data: {
          gameId: game.id,
          name: it.name,
          billerProductCode: it.code,
          basePrice: it.price,
          price,
          memberPrice: mp != null && mp > it.price ? mp : null,
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
      price = applyMargin(it.price, opts.marginBps);
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
