import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await db.game.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true, isPopular: true } });
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/cek-transaksi"), changeFrequency: "monthly", priority: 0.3 },
    ...["/faq", "/contact", "/terms", "/refund-policy"].map((p) => ({
      url: siteUrl(p),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...games.map((g) => ({
      url: siteUrl(`/games/${g.slug}`),
      lastModified: g.updatedAt,
      changeFrequency: "daily" as const,
      priority: g.isPopular ? 0.9 : 0.7,
    })),
  ];
}
