"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GameCover } from "./GameCover";

type G = { slug: string; name: string; publisher: string | null; imageUrl: string | null; isPopular: boolean; categoryId: string };

export function GameGrid({
  games,
  categories,
  initialQuery = "",
}: {
  games: G[];
  categories: { id: string; name: string }[];
  initialQuery?: string;
}) {
  const [cat, setCat] = useState<string | null>(categories[0]?.id ?? null);
  const q = initialQuery.trim().toLowerCase();
  useEffect(() => {
    if (q) setCat(null);
  }, [q]);

  const filtered = useMemo(
    () =>
      games.filter(
        (g) => (q ? true : !cat || g.categoryId === cat) && (!q || g.name.toLowerCase().includes(q) || g.publisher?.toLowerCase().includes(q)),
      ),
    [games, q, cat],
  );

  return (
    <section id="semua" className="mt-10 scroll-mt-32">
      {q ? (
        <h2 className="mb-4 text-lg font-extrabold">
          Hasil pencarian “{initialQuery}” <span className="text-sm font-medium text-muted">({filtered.length})</span>
        </h2>
      ) : (
        <div className="mb-5 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                cat === c.id ? "bg-accent text-white shadow-sm shadow-accent/30" : "border border-line bg-surface text-muted hover:text-fg"
              }`}
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={() => setCat(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              cat === null ? "bg-accent text-white" : "border border-line bg-surface text-muted hover:text-fg"
            }`}
          >
            Semua
          </button>
        </div>
      )}
      {filtered.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {filtered.map((g) => (
            <Link
              key={g.slug}
              href={`/games/${g.slug}`}
              className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-1 hover:border-accent hover:shadow-lg hover:shadow-accent/10"
            >
              <div className="relative overflow-hidden">
                <GameCover name={g.name} imageUrl={g.imageUrl} className="aspect-square w-full transition duration-300 group-hover:scale-105" />
                {g.isPopular && (
                  <span className="absolute top-2 right-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-accent">HOT</span>
                )}
              </div>
              <div className="p-2.5 sm:p-3">
                <div className="truncate text-xs font-bold sm:text-sm">{g.name}</div>
                <div className="truncate text-[11px] text-muted sm:text-xs">{g.publisher}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="card p-10 text-center text-sm text-muted">Tidak ada game atau voucher yang cocok.</p>
      )}
    </section>
  );
}
