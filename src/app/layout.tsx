import { Logo } from "@/components/Logo";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { PayLogo } from "@/components/PayLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/seo";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = `${s.storeName} — Top Up Game & Voucher Termurah, Instan 24 Jam`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s | ${s.storeName}` },
    description: `${s.tagline}. Top up Mobile Legends, Free Fire, PUBG Mobile, Genshin Impact & voucher game lainnya. Bayar QRIS, e-wallet, VA, Alfamart.`,
    applicationName: s.storeName,
    keywords: ["top up game", "top up murah", "diamond mobile legends", "top up free fire", "voucher game", "top up instan", s.storeName],
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: s.storeName, locale: "id_ID", title, description: s.tagline, url: "/" },
    twitter: { card: "summary", title, description: s.tagline },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    formatDetection: { telephone: false },
    ...(s.logoUrl ? { icons: { icon: s.logoUrl, apple: s.logoUrl } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, settings, methods] = await Promise.all([
    getSession(),
    getSettings(),
    db.paymentMethod.findMany({ where: { isActive: true, gateway: { isActive: true } }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, imageUrl: true } }),
  ]);
  const year = new Date().getFullYear();
  return (
    <html lang="id">
      <body className={`${jakarta.variable} flex min-h-dvh flex-col antialiased`}>
        <Suspense>
          <SiteHeader storeName={settings.storeName} logoUrl={settings.logoUrl} session={session ? { name: session.name, role: session.role } : null} />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Logo name={settings.storeName} logoUrl={settings.logoUrl} className="[&>span:last-child]:inline" />
              <p className="mt-3 text-muted">{settings.tagline}</p>
            </div>
            <div>
              <h4 className="font-bold">Peta Situs</h4>
              <ul className="mt-3 space-y-2 text-muted">
                <li><Link href="/" className="hover:text-accent">Beranda</Link></li>
                <li><Link href="/cek-transaksi" className="hover:text-accent">Cek Transaksi</Link></li>
                <li><Link href="/register" className="hover:text-accent">Daftar Member</Link></li>
                <li><Link href="/faq" className="hover:text-accent">FAQ</Link></li>
                <li><Link href="/terms" className="hover:text-accent">Syarat &amp; Ketentuan</Link></li>
                <li><Link href="/refund-policy" className="hover:text-accent">Kebijakan Refund</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold">Dukungan</h4>
              <ul className="mt-3 space-y-2 text-muted">
                {settings.whatsappCs ? (
                  <li><a href={`https://wa.me/${settings.whatsappCs}`} className="hover:text-accent">WhatsApp CS</a></li>
                ) : (
                  <li>Layanan 24 jam</li>
                )}
                {settings.contactEmail && (
                  <li><a href={`mailto:${settings.contactEmail}`} className="break-all hover:text-accent">{settings.contactEmail}</a></li>
                )}
                {settings.contactPhone && <li>{settings.contactPhone}</li>}
                <li><Link href="/contact" className="hover:text-accent">Kontak &amp; Alamat</Link></li>
                <li><Link href="/cek-transaksi" className="hover:text-accent">Status Pesanan</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold">Pembayaran</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {methods.map((m) => (
                  <PayLogo key={m.code} name={m.name} code={m.code} imageUrl={m.imageUrl} className="h-8 w-14" />
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-line py-5 text-center text-xs text-muted">
            © {year} {settings.storeName}. Diproses otomatis oleh Payterra.
          </div>
        </footer>
      </body>
    </html>
  );
}
