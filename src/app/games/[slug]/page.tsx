import { ChevronDown, ChevronRight, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { unitPrice } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { rupiah } from "@/lib/format";
import { gameFaq, jsonLd, siteUrl } from "@/lib/seo";
import { GameCover } from "@/components/GameCover";
import type { InputField } from "@/lib/types";
import { OrderForm } from "./OrderForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// Dipakai generateMetadata + page dalam satu request → satu query.
const getGame = cache((slug: string) =>
  db.game.findUnique({
    where: { slug },
    include: {
      category: true,
      products: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
    },
  }),
);

function priceRange(products: { price: number; billerAvailable: boolean }[]) {
  const ps = products.filter((p) => p.billerAvailable).map((p) => p.price);
  return ps.length ? { low: Math.min(...ps), high: Math.max(...ps), n: ps.length } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [game, s] = await Promise.all([getGame((await params).slug), getSettings()]);
  if (!game?.isActive) return { title: "Tidak ditemukan", robots: { index: false } };
  const range = priceRange(game.products);
  const isVoucher = (game.inputFields as InputField[]).length === 0;
  const title = game.seoTitle || `Top Up ${game.name} Termurah${range ? ` mulai ${rupiah(range.low)}` : ""}`;
  const description =
    game.seoDescription ||
    `${isVoucher ? "Beli" : "Top up"} ${game.name} murah, aman & instan 24 jam di ${s.storeName}.` +
      (range ? ` ${range.n} pilihan nominal mulai ${rupiah(range.low)}.` : "") +
      " Bayar pakai QRIS, DANA, OVO, ShopeePay, virtual account, atau Alfamart.";
  const url = siteUrl(`/games/${game.slug}`);
  const image = game.bannerUrl || game.imageUrl;
  return {
    title,
    description,
    keywords: [`top up ${game.name}`, `${game.name} murah`, `beli ${game.name}`, game.publisher ?? "", "top up game", s.storeName].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: s.storeName,
      locale: "id_ID",
      images: image ? [{ url: image, alt: game.name }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const [game, session, methods, settings] = await Promise.all([
    getGame(slug),
    getSession(),
    db.paymentMethod.findMany({ where: { isActive: true, gateway: { isActive: true } }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!game?.isActive) notFound();
  const soldCount = await db.order.count({ where: { gameId: game.id, fulfillmentStatus: "SUCCESS" } });

  const isMember = !!session;
  const fields = game.inputFields as InputField[];
  const products = game.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: unitPrice(p, isMember),
    normalPrice: p.price,
    // Tunjukkan harga member ke tamu sebagai insentif daftar.
    memberPrice: !isMember && p.memberPrice != null && p.memberPrice < p.price ? p.memberPrice : null,
    available: p.billerAvailable,
  }));

  const range = priceRange(game.products);
  const faq = gameFaq(game, settings.storeName);
  const url = siteUrl(`/games/${game.slug}`);
  const about =
    game.description ||
    `${game.name}${game.publisher ? ` dari ${game.publisher}` : ""} bisa kamu top up dengan cepat dan aman di ${settings.storeName}. ` +
      `${fields.length ? `Cukup masukkan ${fields.map((f) => f.label).join(" dan ")}, ` : ""}pilih nominal, bayar, dan pesanan diproses otomatis dalam hitungan detik — 24 jam setiap hari.`;

  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `Top Up ${game.name}`,
      description: about,
      image: game.imageUrl ? (game.imageUrl.startsWith("/") ? siteUrl(game.imageUrl) : game.imageUrl) : undefined,
      brand: game.publisher ? { "@type": "Brand", name: game.publisher } : undefined,
      category: game.category.name,
      url,
      ...(range && {
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "IDR",
          lowPrice: range.low,
          highPrice: range.high,
          offerCount: range.n,
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: settings.storeName },
        },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl("/") },
        { "@type": "ListItem", position: 2, name: game.category.name, item: siteUrl("/") },
        { "@type": "ListItem", position: 3, name: game.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  const steps = [
    ...(fields.length ? [`Masukkan ${fields.map((f) => f.label).join(" dan ")} akun ${game.name} kamu${game.nicknameCheck ? ", lalu klik Cek Akun" : ""}.`] : []),
    "Pilih nominal yang kamu inginkan.",
    "Pilih metode pembayaran: QRIS, e-wallet, virtual account, atau gerai retail.",
    "Isi nomor WhatsApp untuk bukti transaksi, lalu klik Pesan Sekarang.",
    `Selesaikan pembayaran. ${fields.length ? "Item masuk otomatis ke akun kamu" : "Kode voucher tampil di halaman invoice"} dalam hitungan detik.`,
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <div className="border-b border-line bg-surface">
        <div className="relative h-32 overflow-hidden sm:h-48">
          {game.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.bannerUrl} alt={`Banner ${game.name}`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <GameCover name={game.name} imageUrl={game.imageUrl} className="absolute inset-0 h-full w-full scale-125 blur-xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white" />
        </div>
        <div className="relative mx-auto flex max-w-6xl gap-4 px-4 pb-6 sm:gap-6">
          <GameCover
            name={`Logo ${game.name}`}
            imageUrl={game.imageUrl}
            className="-mt-16 h-28 w-28 shrink-0 rounded-2xl border-4 border-white shadow-xl sm:-mt-24 sm:h-44 sm:w-44"
          />
          <div className="min-w-0 pt-2 sm:pt-4">
            <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted">
              <Link href="/" className="hover:text-accent">Beranda</Link>
              <ChevronRight className="h-3 w-3" />
              <span>{game.category.name}</span>
            </nav>
            <h1 className="text-xl font-black tracking-tight uppercase sm:text-3xl">
              <span className="sr-only">Top Up </span>
              {game.name}
            </h1>
            {game.publisher && <p className="text-sm font-medium text-muted">{game.publisher}</p>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold sm:text-sm">
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-accent" /> Proses Cepat</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-accent" /> Layanan 24/7</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent" /> Pembayaran Aman</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <OrderForm
          gameSlug={game.slug}
          gameName={game.name}
          fields={fields}
          inputHint={game.inputHint}
          nicknameCheck={game.nicknameCheck}
          soldCount={soldCount}
          lowPrice={range?.low ?? null}
          products={products}
          methods={methods.map((m) => ({
            code: m.code,
            name: m.name,
            group: m.group,
            feeFlat: m.feeFlat,
            feeBps: m.feeBps,
            minAmount: m.minAmount,
            maxAmount: m.maxAmount,
            imageUrl: m.imageUrl,
          }))}
          isMember={isMember}
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Tentang Top Up {game.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{about}</p>
              {range && (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Tersedia {range.n} pilihan nominal {game.name} dengan harga mulai{" "}
                  <b className="text-fg">{rupiah(range.low)}</b> hingga <b className="text-fg">{rupiah(range.high)}</b>.
                </p>
              )}
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Cara Top Up {game.name}</h2>
              <ol className="mt-4 space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-muted">{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Pertanyaan Umum (FAQ)</h2>
              <div className="mt-3 divide-y divide-line">
                {faq.map((f) => (
                  <details key={f.q} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      <h3>{f.q}</h3>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
