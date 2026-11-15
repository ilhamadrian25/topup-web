"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const Icon = {
  search: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" strokeLinejoin="round" />
    </svg>
  ),
  login: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function SiteHeader({
  storeName,
  logoUrl,
  session,
}: {
  storeName: string;
  logoUrl?: string;
  session: { name: string; role: "MEMBER" | "ADMIN" } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);

  const tabs = [
    { href: "/", label: "Topup", icon: Icon.cart, active: pathname === "/" || pathname.startsWith("/games") },
    { href: "/cek-transaksi", label: "Cek Transaksi", icon: Icon.receipt, active: pathname.startsWith("/cek-transaksi") || pathname.startsWith("/invoice") },
    ...(session ? [{ href: "/akun", label: "Riwayat", icon: Icon.user, active: pathname.startsWith("/akun") }] : []),
    ...(session?.role === "ADMIN" ? [{ href: "/admin", label: "Admin", icon: Icon.shield, active: pathname.startsWith("/admin") }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5">
        <Link href="/" className="shrink-0">
          <Logo name={storeName} logoUrl={logoUrl} />
        </Link>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}#semua` : "/");
          }}
        >
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{Icon.search}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari Game atau Voucher"
            className="h-10 w-full rounded-full border border-line bg-surface-2 pr-4 pl-10 text-sm outline-none focus:border-accent focus:bg-surface"
          />
        </form>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold sm:flex">
          🇮🇩 ID / IDR
        </span>
      </div>
      <nav className="mx-auto flex h-11 max-w-6xl items-stretch gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2 font-semibold transition ${
              t.active ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center">
          {session ? (
            <Link href="/akun" className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {session.name[0]?.toUpperCase() ?? "U"}
              </span>
              <span className="hidden sm:inline">{session.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 font-semibold text-muted hover:text-fg">
              {Icon.login} Masuk
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
