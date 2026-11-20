"use client";

import type { FulfillmentStatus, PaymentStatus } from "@prisma/client";

/**
 * Pesanan yang dibuat dari browser ini, disimpan di localStorage supaya
 * pembeli tanpa akun tetap bisa membuka invoice terakhir walau tab tertutup
 * atau nomor invoice lupa. Hanya ringkasan: tanpa nomor HP / data akun.
 * Sumber kebenaran tetap server (/api/orders/[invoice]); ini hanya daftar link.
 */
export type RecentOrder = {
  invoice: string;
  gameName: string;
  gameSlug: string;
  productName: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  expiresAt: string;
  createdAt: string;
};

const KEY = "topupin:orders:v1";
const EVENT = "topupin:orders";
const MAX = 20;
const KEEP_DAYS = 90;

export function isOpenOrder(o: Pick<RecentOrder, "paymentStatus" | "fulfillmentStatus" | "expiresAt">): boolean {
  if (o.paymentStatus === "UNPAID") return new Date(o.expiresAt).getTime() > Date.now();
  return o.paymentStatus === "PAID" && (o.fulfillmentStatus === "WAITING" || o.fulfillmentStatus === "PROCESSING");
}

export function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentOrder[]) : [];
    if (!Array.isArray(list)) return [];
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    return list
      .filter((o) => o && typeof o.invoice === "string" && new Date(o.createdAt).getTime() > cutoff)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function write(list: RecentOrder[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage penuh / diblokir (mode privat): fitur ini opsional.
  }
}

export function saveRecentOrder(o: RecentOrder) {
  const list = loadRecentOrders().filter((x) => x.invoice !== o.invoice);
  write([o, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function removeRecentOrder(invoice: string) {
  write(loadRecentOrders().filter((x) => x.invoice !== invoice));
}

export function clearRecentOrders() {
  write([]);
}

/** Dipanggil saat daftar berubah (tab ini lewat EVENT, tab lain lewat "storage"). */
export function onRecentOrdersChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Ringkasan dari respons /api/orders/[invoice] (atau props invoice). */
export function toRecentOrder(o: {
  invoice: string;
  productName: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  expiresAt: string | Date;
  createdAt: string | Date;
  game: { name: string; slug: string };
}): RecentOrder {
  return {
    invoice: o.invoice,
    gameName: o.game.name,
    gameSlug: o.game.slug,
    productName: o.productName,
    total: o.total,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    expiresAt: new Date(o.expiresAt).toISOString(),
    createdAt: new Date(o.createdAt).toISOString(),
  };
}
