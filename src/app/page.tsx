import { BadgePercent, ChevronRight, Flame, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { jsonLd, siteUrl } from "@/lib/seo";
import { rupiah } from "@/lib/format";
import { GameGrid } from "@/components/GameGrid";
import { GameCover } from "@/components/GameCover";
import { HeroCarousel } from "@/components/HeroCarousel";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [settings, banners, categories, games, promos] = await Promise.all([
    getSettings(),
    db.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.game.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, publisher: true, imageUrl: true, isPopular: true, categoryId: true },
    }),
    // Produk dengan harga member terbesar selisihnya — promo nyata, bukan dummy.
    db.product.findMany({
      where: { isActive: true, billerAvailable: true, memberPrice: { not: null }, game: { isActive: true, isPopular: true } },
      include: { game: { select: { slug: true, name: true, imageUrl: true } } },
      orderBy: { price: "desc" },
      take: 40,
    }),
  ]);

  const promoList = promos
    .map((p) => ({ ...p, save: p.price - (p.memberPrice ?? p.price) }))
    .filter((p) => p.save > 0)
    .sort((a, b) => b.save - a.save)
    .filter((p, i, arr) => arr.findIndex((x) => x.gameId === p.gameId) === i || i < 10)
    .slice(0, 10);

  const trending = games.filter((g) => g.isPopular).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            { "@context": "https://schema.org", "@type": "Organization", name: settings.storeName, url: siteUrl("/"), ...(settings.logoUrl ? { logo: siteUrl(settings.logoUrl) } : {}) },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: settings.storeName,
              url: siteUrl("/"),
              potentialAction: { "@type": "SearchAction", target: `${siteUrl("/")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "Top up game & voucher",
              itemListElement: games.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: `Top Up ${g.name}`, url: siteUrl(`/games/${g.slug}`) })),
            },
          ]),
        }}
      />
      <h1 className="sr-only">{settings.storeName}: Top Up Game & Voucher Termurah, Instan 24 Jam</h1>
      {!q && (
        <>
          <section className="pt-5">
            <HeroCarousel slides={banners} />
          </section>

          {promoList.length > 0 && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-orange-50 to-white">
              <div className="flex items-end justify-between px-5 pt-5">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black tracking-tight uppercase">
                    <Zap className="h-5 w-5 fill-accent text-accent" /> Promo Member
                  </h2>
                  <p className="text-xs text-muted">Masuk sebagai member untuk dapat harga spesial ini.</p>
                </div>
                <Link href="/register" className="hidden text-sm font-semibold text-accent hover:underline sm:block">
                  Daftar gratis ›
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto px-5 pt-4 pb-5 [scrollbar-width:thin]">
                {promoList.map((p) => {
                  const pct = Math.round((p.save / p.price) * 100);
                  return (
                    <Link
                      key={p.id}
                      href={`/games/${p.game.slug}`}
                      className="w-56 shrink-0 rounded-xl border border-line bg-surface p-3 transition hover:border-accent"
                    >
                      <div className="flex items-start gap-2.5">
                        <GameCover name={p.game.name} imageUrl={p.game.imageUrl} className="h-10 w-10 shrink-0 rounded-lg" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{p.name}</div>
                          <div className="truncate text-xs text-muted">{p.game.name}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <div className="text-base font-extrabold text-accent">{rupiah(p.memberPrice!)}</div>
                          <div className="text-xs text-muted line-through">{rupiah(p.price)}</div>
                        </div>
                        <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">-{Math.max(pct, 1)}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {trending.length > 0 && (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-lg font-black tracking-tight uppercase">
                <Flame className="h-5 w-5 fill-orange-400 text-accent" /> Trending
              </h2>
              <p className="mb-4 text-xs text-muted">Berikut adalah beberapa produk yang paling populer saat ini.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/games/${g.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
                  >
                    <GameCover name={g.name} imageUrl={g.imageUrl} className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{g.name}</div>
                      <div className="truncate text-xs text-muted">{g.publisher}</div>
                    </div>
                    <ChevronRight className="mr-1 h-5 w-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <GameGrid games={games} categories={categories.map((c) => ({ id: c.id, name: c.name }))} initialQuery={q} />

      {!q && (
        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          {([
            [Zap, "Proses Instan", "Pesanan diproses otomatis begitu pembayaran diterima, 24 jam."],
            [ShieldCheck, "Aman & Resmi", "Produk langsung dari supplier resmi, tanpa perlu password akun."],
            [BadgePercent, "Harga Bersaing", "Harga transparan, lebih murah lagi untuk member."],
          ] as const).map(([Icon, t, d]) => (
            <div key={t} className="card flex gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-accent"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="font-bold">{t}</div>
                <div className="text-sm text-muted">{d}</div>
              </div>
            </div>
          ))}
        </section>
      )}
      {!q && (
        <section className="card mt-10 p-6 text-sm leading-relaxed text-muted">
          <h2 className="text-base font-extrabold text-fg">Top Up Game Murah, Cepat & Aman di {settings.storeName}</h2>
          <p className="mt-2">
            {settings.storeName} adalah tempat top up game dan voucher digital dengan proses otomatis 24 jam. Top up{" "}
            {games.slice(0, 6).map((g, i, a) => (
              <span key={g.slug}>
                <Link href={`/games/${g.slug}`} className="font-semibold text-fg hover:text-accent">{g.name}</Link>
                {i < a.length - 2 ? ", " : i === a.length - 2 ? ", dan " : ""}
              </span>
            ))}{" "}
            cukup dengan memasukkan ID akun, memilih nominal, dan membayar lewat QRIS, e-wallet, virtual account, atau
            gerai retail. Pesanan langsung diproses begitu pembayaran diterima.
          </p>
          <p className="mt-2">
            Daftar sebagai member gratis untuk menikmati harga lebih murah di setiap transaksi dan menyimpan riwayat pembelian.
          </p>
        </section>
      )}
    </div>
  );
}
