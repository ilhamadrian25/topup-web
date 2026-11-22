import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryMarkups, getSettings, type Margin } from "@/lib/settings";
import { rupiah } from "@/lib/format";
import { GameForm } from "../GameForm";
import { Flash, type FlashSP } from "../../Flash";
import { saveProductsAction } from "../../actions";

const markupLabel = (m: Margin) => [m.bps ? `${m.bps / 100}%` : null, m.flat ? `Rp ${m.flat.toLocaleString("id-ID")}` : null].filter(Boolean).join(" + ") || "0";

export default async function AdminGameDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: FlashSP }) {
  const { id } = await params;
  const [game, categories, settings] = await Promise.all([
    db.game.findUnique({ where: { id }, include: { category: true, products: { orderBy: [{ sortOrder: "asc" }, { basePrice: "asc" }] } } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!game) notFound();
  const m = categoryMarkups(game.category, settings);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/games" className="text-sm text-muted hover:text-fg">‹ Game</Link>
        <h1 className="mt-2 text-xl font-bold">{game.name}</h1>
      </div>
      <Flash sp={await searchParams} />
      <GameForm game={game} categories={categories} />

      <div>
        <div className="mb-3">
          <h2 className="text-lg font-bold">Produk ({game.products.length})</h2>
          <p className="mt-1 text-sm text-muted">
            Harga otomatis = modal Payterra + markup kategori <b>{game.category.name}</b>: biasa {markupLabel(m.normal)}, member{" "}
            {markupLabel(m.member)}. Ubah markup di <Link href="/admin/settings" className="text-accent hover:underline">Pengaturan</Link>.
          </p>
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
                      <td className="whitespace-nowrap">{rupiah(p.price)}</td>
                      <td className="whitespace-nowrap">{p.memberPrice != null ? rupiah(p.memberPrice) : "-"}</td>
                      <td className="whitespace-nowrap text-success">
                        {rupiah(p.price - p.basePrice)}
                        {p.memberPrice != null && <div className="text-xs text-muted">member {rupiah(p.memberPrice - p.basePrice)}</div>}
                      </td>
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
