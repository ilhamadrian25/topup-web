import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { activeBiller, billerForOrder, type BillerTxResult } from "./biller";
import { gatewayAdapter } from "./payment";
import { siteUrl } from "./seo";
import { normalizePhone } from "./format";
import type { InputField } from "./types";

export class OrderError extends Error {}

const EXPIRY_MIN = Number(process.env.PAYMENT_EXPIRY_MINUTES ?? 60);
/** Jangan polling biller lebih sering dari ini per order. */
const STATUS_POLL_MS = 3_000;
/** Jangan tanya status pembayaran ke gateway lebih sering dari ini per order. */
const PAYMENT_POLL_MS = 10_000;

function newInvoice(): string {
  const d = new Date();
  const ymd = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `TW${ymd}${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function calcFee(price: number, m: { feeFlat: number; feeBps: number }): number {
  return m.feeFlat + Math.ceil((price * m.feeBps) / 10000);
}

export function unitPrice(p: { price: number; memberPrice: number | null }, isMember: boolean): number {
  return isMember && p.memberPrice != null && p.memberPrice < p.price ? p.memberPrice : p.price;
}

async function logEvent(orderId: string, type: string, message: string, data?: unknown) {
  await db.orderEvent.create({
    data: { orderId, type, message, data: (data ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}

/** Validasi & normalisasi input akun sesuai inputFields game. */
export function parseAccount(fields: InputField[], raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = String(raw?.[f.key] ?? "").trim();
    if (!v) throw new OrderError(`${f.label} wajib diisi`);
    if (v.length > 64) throw new OrderError(`${f.label} terlalu panjang`);
    if (f.options && !f.options.some((o) => o.value === v)) throw new OrderError(`${f.label} tidak valid`);
    out[f.key] = v;
  }
  return out;
}

export async function createOrder(input: {
  gameSlug: string;
  productId: string;
  account: Record<string, unknown>;
  paymentMethodCode: string;
  phone: string;
  email?: string;
  userId?: string | null;
}) {
  const game = await db.game.findUnique({ where: { slug: input.gameSlug } });
  if (!game?.isActive) throw new OrderError("Game tidak tersedia");

  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product || product.gameId !== game.id || !product.isActive || !product.billerAvailable)
    throw new OrderError("Produk tidak tersedia");

  const method = await db.paymentMethod.findUnique({ where: { code: input.paymentMethodCode }, include: { gateway: true } });
  if (!method?.isActive || !method.gateway?.isActive) throw new OrderError("Metode pembayaran tidak tersedia");
  const gateway = method.gateway;

  const phone = normalizePhone(input.phone);
  if (!phone) throw new OrderError("Nomor WhatsApp tidak valid");
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OrderError("Email tidak valid");

  const account = parseAccount(game.inputFields as InputField[], input.account);

  // Nickname selalu dicek ulang di server; jangan percaya nilai dari client.
  let nickname: string | null = null;
  if (game.nicknameCheck) {
    const r = await (await activeBiller()).adapter.checkAccount({
      brandCode: game.billerBrandCode,
      productCode: product.billerProductCode,
      account,
    });
    if (!r.ok) throw new OrderError(r.message);
    nickname = r.nickname;
  }

  const price = unitPrice(product, !!input.userId);
  const fee = calcFee(price, method);
  const total = price + fee;
  if (total < method.minAmount) throw new OrderError(`Minimal transaksi ${method.name} adalah ${method.minAmount}`);
  if (method.maxAmount != null && total > method.maxAmount)
    throw new OrderError(`Maksimal transaksi ${method.name} adalah ${method.maxAmount}`);

  const expiresAt = new Date(Date.now() + EXPIRY_MIN * 60_000);
  const order = await db.order.create({
    data: {
      invoice: newInvoice(),
      userId: input.userId ?? null,
      gameId: game.id,
      productId: product.id,
      productName: product.name,
      accountData: account,
      nickname,
      contactPhone: phone,
      contactEmail: email,
      price,
      fee,
      total,
      basePrice: product.basePrice,
      paymentMethodId: method.id,
      paymentGatewayId: gateway.id,
      expiresAt,
    },
  });
  await logEvent(order.id, "created", "Order dibuat");

  try {
    const charge = await gatewayAdapter(gateway).createCharge({
      invoice: order.invoice,
      amount: total,
      method,
      expiresAt,
      customer: { name: nickname || "Pelanggan", phone, email },
      notifyUrl: siteUrl(`/api/payments/callback/${gateway.code}`),
      returnUrl: siteUrl(`/invoice/${order.invoice}`),
    });
    await db.order.update({
      where: { id: order.id },
      data: {
        paymentRef: charge.paymentRef,
        paymentData: charge.paymentData,
        // Pakai batas waktu gateway kalau lebih cepat dari milik kita.
        ...(charge.expiresAt && charge.expiresAt < expiresAt ? { expiresAt: charge.expiresAt } : {}),
      },
    });
    await logEvent(order.id, "charge", `Tagihan dibuat di ${gateway.name}`, { paymentRef: charge.paymentRef });
  } catch (e) {
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED", fulfillmentStatus: "FAILED" } });
    await logEvent(order.id, "payment_error", "Gagal membuat tagihan", { error: String(e) });
    throw new OrderError("Gagal membuat tagihan pembayaran, coba metode lain");
  }
  return order.invoice;
}

/**
 * Dipanggil oleh webhook payment gateway (atau tombol simulasi di mode mock).
 * Idempoten: panggilan berulang untuk invoice yang sama hanya memproses sekali.
 */
export async function markOrderPaid(invoice: string, opts: { paymentRef?: string; source: string; amount?: number }) {
  const order = await db.order.findUnique({ where: { invoice } });
  if (!order) throw new OrderError("Invoice tidak ditemukan");
  // Lebih bayar diterima; kurang bayar ditolak.
  if (opts.amount != null && opts.amount < order.total) {
    await logEvent(order.id, "payment_mismatch", "Nominal pembayaran tidak sesuai", opts);
    throw new OrderError("Nominal pembayaran tidak sesuai");
  }
  // EXPIRED tetap diterima: uang sudah masuk, jadi order tetap diproses.
  const { count } = await db.order.updateMany({
    where: { id: order.id, paymentStatus: { in: ["UNPAID", "EXPIRED"] } },
    data: { paymentStatus: "PAID", paidAt: new Date(), ...(opts.paymentRef ? { paymentRef: opts.paymentRef } : {}) },
  });
  if (count === 0) return; // sudah diproses sebelumnya
  await logEvent(order.id, "paid", `Pembayaran diterima (${opts.source})`);
  await fulfillOrder(order.id);
}

/**
 * Tanya status pembayaran ke gateway lalu terapkan. Dipakai callback (dengan
 * transactionId dari body callback) dan polling. Body callback tidak dipercaya:
 * yang menentukan adalah jawaban API gateway, dan referenceId-nya harus invoice ini.
 */
export async function syncGatewayPayment(invoice: string, transactionId?: string) {
  const order = await db.order.findUnique({ where: { invoice }, include: { paymentGateway: true } });
  if (!order?.paymentGateway) throw new OrderError("Order tidak memakai gateway");
  const ref = transactionId ?? order.paymentRef;
  if (!ref) return null; // redirect: ID transaksi baru diketahui saat callback
  const gw = order.paymentGateway;
  const st = await gatewayAdapter(gw).checkStatus(ref);
  if (st.referenceId !== order.invoice) {
    await logEvent(order.id, "payment_mismatch", "Referensi transaksi gateway tidak cocok", { ref, referenceId: st.referenceId });
    throw new OrderError("Referensi transaksi tidak cocok");
  }
  if (st.status === "PAID") {
    await markOrderPaid(invoice, { paymentRef: st.transactionId, amount: st.amount ?? undefined, source: gw.code });
  } else if (st.status === "EXPIRED" || st.status === "FAILED") {
    const { count } = await db.order.updateMany({
      where: { id: order.id, paymentStatus: "UNPAID" },
      data: { paymentStatus: st.status, ...(st.status === "FAILED" ? { fulfillmentStatus: "FAILED" } : {}) },
    });
    if (count) await logEvent(order.id, st.status === "EXPIRED" ? "expired" : "payment_failed", `Status gateway: ${st.status}`, st.raw);
  } else if (!order.paymentRef && transactionId) {
    await db.order.update({ where: { id: order.id }, data: { paymentRef: transactionId } });
  }
  return st.status;
}

/** Klaim order PAID+WAITING lalu kirim ke biller. Aman dipanggil paralel. */
export async function fulfillOrder(orderId: string) {
  const { count } = await db.order.updateMany({
    where: { id: orderId, paymentStatus: "PAID", fulfillmentStatus: "WAITING" },
    data: { fulfillmentStatus: "PROCESSING", fulfillAttempts: { increment: 1 } },
  });
  if (count === 0) return;

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true } });
  const refId = `${order.invoice}-${order.fulfillAttempts}`;
  // Catat biller yang dipakai percobaan ini: status & webhook-nya selalu dicek ke biller yang sama,
  // walau biller aktif diganti di tengah jalan.
  const { account, adapter } = await activeBiller();
  await db.order.update({ where: { id: orderId }, data: { billerRefId: refId, billerAccountId: account?.id ?? null } });

  try {
    const r = await adapter.purchase({
      refId,
      productCode: order.product.billerProductCode,
      account: order.accountData as Record<string, string>,
    });
    await logEvent(orderId, "biller_purchase", `Dikirim ke biller: ${r.status}`, r);
    await applyBillerResult(orderId, r);
  } catch (e) {
    // Status tidak pasti (timeout/jaringan): tetap PROCESSING, diselesaikan lewat checkStatus/callback.
    await logEvent(orderId, "biller_error", "Gagal menghubungi biller, akan dicek ulang", { error: String(e) });
  }
}

export async function applyBillerResult(orderId: string, r: BillerTxResult) {
  if (r.status === "PENDING") {
    await db.order.updateMany({
      where: { id: orderId, fulfillmentStatus: "PROCESSING" },
      data: { billerRef: r.billerRef ?? undefined, billerMessage: r.message },
    });
    return;
  }
  const { count } = await db.order.updateMany({
    where: { id: orderId, fulfillmentStatus: "PROCESSING" },
    data: {
      fulfillmentStatus: r.status,
      billerRef: r.billerRef ?? undefined,
      billerSn: r.sn ?? null,
      billerMessage: r.message,
      fulfilledAt: r.status === "SUCCESS" ? new Date() : null,
    },
  });
  if (count) await logEvent(orderId, r.status === "SUCCESS" ? "success" : "failed", r.message, r);
}

/**
 * Sinkronisasi status "lazy" saat order dibuka: kedaluwarsakan invoice,
 * lanjutkan order PAID yang belum terkirim, dan polling biller untuk PROCESSING.
 */
export async function refreshOrder(invoice: string) {
  const order = await db.order.findUnique({ where: { invoice } });
  if (!order) return null;

  if (order.paymentStatus === "UNPAID" && order.expiresAt < new Date()) {
    const { count } = await db.order.updateMany({
      where: { id: order.id, paymentStatus: "UNPAID" },
      data: { paymentStatus: "EXPIRED" },
    });
    if (count) await logEvent(order.id, "expired", "Invoice kedaluwarsa");
  } else if (
    order.paymentStatus === "UNPAID" &&
    order.paymentRef &&
    !order.paymentRef.startsWith("MOCKPAY-") &&
    Date.now() - order.updatedAt.getTime() > PAYMENT_POLL_MS
  ) {
    // Cadangan kalau callback gateway tidak sampai (mis. localhost).
    await db.order.update({ where: { id: order.id }, data: { updatedAt: new Date() } });
    await syncGatewayPayment(invoice).catch((e) => logEvent(order.id, "payment_check_error", "Cek status gateway gagal", { error: String(e) }));
  } else if (order.paymentStatus === "PAID" && order.fulfillmentStatus === "WAITING") {
    await fulfillOrder(order.id);
  } else if (
    order.fulfillmentStatus === "PROCESSING" &&
    order.billerRefId &&
    Date.now() - order.updatedAt.getTime() > STATUS_POLL_MS
  ) {
    try {
      const r = await (await billerForOrder(order)).adapter.checkStatus({ refId: order.billerRefId });
      await applyBillerResult(order.id, r);
      // Sentuh updatedAt supaya throttle polling berlaku.
      if (r.status === "PENDING") await db.order.update({ where: { id: order.id }, data: { updatedAt: new Date() } });
    } catch (e) {
      await logEvent(order.id, "biller_error", "Cek status gagal", { error: String(e) });
    }
  }
  return order.id;
}

/** Admin: kirim ulang order yang gagal ke biller (refId baru). */
export async function retryFulfillment(orderId: string) {
  const { count } = await db.order.updateMany({
    where: { id: orderId, paymentStatus: "PAID", fulfillmentStatus: "FAILED" },
    data: { fulfillmentStatus: "WAITING", billerSn: null, billerMessage: null },
  });
  if (!count) throw new OrderError("Hanya order PAID yang gagal yang bisa dikirim ulang");
  await logEvent(orderId, "retry", "Dikirim ulang oleh admin");
  await fulfillOrder(orderId);
}

/** Admin: tandai order gagal sudah di-refund manual ke pembeli. */
export async function markRefunded(orderId: string, note: string) {
  const { count } = await db.order.updateMany({
    where: { id: orderId, paymentStatus: "PAID", fulfillmentStatus: "FAILED" },
    data: { fulfillmentStatus: "REFUNDED" },
  });
  if (!count) throw new OrderError("Hanya order PAID yang gagal yang bisa di-refund");
  await logEvent(orderId, "refunded", note || "Refund manual oleh admin");
}

/** Bentuk order yang aman ditampilkan ke publik (tanpa data internal). */
export async function getPublicOrder(invoice: string) {
  return db.order.findUnique({
    where: { invoice },
    select: {
      invoice: true,
      productName: true,
      accountData: true,
      nickname: true,
      contactPhone: true,
      price: true,
      fee: true,
      total: true,
      paymentStatus: true,
      paymentData: true,
      expiresAt: true,
      paidAt: true,
      fulfillmentStatus: true,
      billerSn: true,
      billerMessage: true,
      fulfilledAt: true,
      createdAt: true,
      game: { select: { name: true, slug: true, imageUrl: true, inputFields: true } },
      paymentMethod: { select: { name: true, group: true } },
      paymentGateway: { select: { provider: true } },
    },
  });
}
export type PublicOrder = NonNullable<Awaited<ReturnType<typeof getPublicOrder>>>;
