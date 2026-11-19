"use client";

import { CreditCard, Gamepad2, Image as ImageIcon, LayoutDashboard, PlugZap, ReceiptText, Settings, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Transaksi", icon: ReceiptText },
  { href: "/admin/games", label: "Game & Produk", icon: Gamepad2 },
  { href: "/admin/payment-methods", label: "Metode Bayar", icon: Wallet },
  { href: "/admin/payment-gateways", label: "Payment Gateway", icon: CreditCard },
  { href: "/admin/billers", label: "Biller", icon: PlugZap },
  { href: "/admin/banners", label: "Banner", icon: ImageIcon },
  { href: "/admin/users", label: "User", icon: Users },
  { href: "/admin/settings", label: "Pengaturan & Sync", icon: Settings },
];

export function AdminNav({ attention }: { attention: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col [scrollbar-width:none]">
      <div className="mb-2 hidden px-3 text-[11px] font-bold tracking-wider text-muted uppercase md:block">Admin Panel</div>
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-accent text-white shadow-sm shadow-accent/30" : "text-muted hover:bg-surface hover:text-fg"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/admin/orders" && attention > 0 && (
              <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white text-accent" : "bg-danger text-white"}`}>
                {attention}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
