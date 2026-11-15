import { Flame } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { GameCover } from "@/components/GameCover";
import { GameForm } from "./GameForm";
import { Flash, type FlashSP } from "../Flash";

export default async function AdminGames({ searchParams }: { searchParams: FlashSP }) {
  const [games, categories] = await Promise.all([
    db.game.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { category: true, _count: { select: { products: true } } },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Game & Produk</h1>
      <Flash sp={await searchParams} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th></th><th>Nama</th><th>Kategori</th><th>Brand biller</th><th>Produk</th><th>Status</th></tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id}>
                <td><GameCover name={g.name} imageUrl={g.imageUrl} className="h-10 w-10 rounded-lg" /></td>
                <td>
                  <Link href={`/admin/games/${g.id}`} className="font-semibold text-accent hover:underline">{g.name}</Link>
                  <div className="text-xs text-muted">/{g.slug}</div>
                </td>
                <td>{g.category.name}</td>
                <td className="font-mono">{g.billerBrandCode}</td>
                <td>{g._count.products}</td>
                <td>{g.isActive ? "Aktif" : <span className="text-muted">Nonaktif</span>}{g.isPopular && <Flame className="ml-1 inline h-4 w-4 text-accent" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-6">
        <summary className="cursor-pointer font-semibold">+ Tambah game baru</summary>
        <div className="mt-3"><GameForm categories={categories} /></div>
      </details>
    </div>
  );
}
