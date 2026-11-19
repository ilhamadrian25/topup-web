import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryMargin, getSettings } from "@/lib/settings";
import { rupiah } from "@/lib/format";
import { GameForm } from "../GameForm";
import { Flash, type FlashSP } from "../../Flash";
import { bulkMarginAction, saveProductsAction } from "../../actions";

export default async function AdminGameDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: FlashSP }) {
  const { id } = await params;
  const [game, categories, settings] = await Promise.all([
    db.game.findUnique({ where: { id }, include: { category: true, products: { orderBy: [{ sortOrder: "asc" }, { basePrice: "asc" }] } } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!game) notFound();
  const margin = categoryMargin(game.category, settings.defaultMarginBps);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/games" className="text-sm text-muted hover:text-fg">‹ Game</Link>
        <h1 className="mt-2 text-xl font-bold">{game.name}</h1>
      </div>
      <Flash sp={await searchParams} />
      <GameForm game={game} categories={categories} />

      <div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-bold">Produk ({game.products.length})</h2>
          <form action={bulkMarginAction} className="ml-auto flex items-end gap-2">
            <input type="hidden" name="gameId" value={game.id} />
            <div>
              <label className="label" htmlFor="marginBps">Set margin semua (bps, 500 = 5%)</label>
              <input id="marginBps" name="marginBps" type="number" min={0} defaultValue={margin.bps} className="input !w-32 !py-1.5" />
            </div>
            <div>
              <label className="label" htmlFor="marginFlat">+ Rp tetap</label>
              <input id="marginFlat" name="marginFlat" type="number" min={0} step={100} defaultValue={margin.flat} className="input !w-28 !py-1.5" />
            </div>
            <button className="btn-ghost !py-1.5">Terapkan</button>
          </form>
        </div>
        {game.products.length === 0 ? (
          <p className="card p-6 text-sm text-muted">
            Belum ada produk. Jalankan <Link href="/admin/settings" className="text-accent">Sync Produk</Link> — produk biller
            dengan brand <code>{game.billerBrandCode}</code> akan otomatis masuk.
          </p>
        ) : (
          <form action={saveProductsAction}>
            <input type="hidden" name="gameId" value={game.id} />
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Aktif</th><th>Nama</th><th>Kode</th><th>Modal</th><th>Harga jual</th><th>Harga member</th><th>Laba</th><th>Urut</th></tr>
                </thead>
                <tbody>
                  {game.products.map((p) => (
                    <tr key={p.id} className={p.billerAvailable ? "" : "opacity-60"}>
                      <td>
                        <input type="hidden" name="pid" value={p.id} />
                        <input type="checkbox" name={`active_${p.id}`} defaultChecked={p.isActive} />
                      </td>
                      <td>
                        <input name={`name_${p.id}`} defaultValue={p.name} className="input !py-1.5 min-w-40" />
                        {!p.billerAvailable && <div className="mt-1 text-xs text-danger">Tidak tersedia di biller</div>}
                      </td>
                      <td className="font-mono text-xs">{p.billerProductCode}</td>
                      <td className="whitespace-nowrap">{rupiah(p.basePrice)}</td>
                      <td><input name={`price_${p.id}`} type="number" defaultValue={p.price} className="input !w-28 !py-1.5" /></td>
                      <td><input name={`member_${p.id}`} type="number" defaultValue={p.memberPrice ?? ""} placeholder="-" className="input !w-28 !py-1.5" /></td>
                      <td className="whitespace-nowrap text-success">{rupiah(p.price - p.basePrice)}</td>
                      <td><input name={`sort_${p.id}`} type="number" defaultValue={p.sortOrder} className="input !w-16 !py-1.5" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary mt-3">Simpan produk</button>
          </form>
        )}
      </div>
    </div>
  );
}
