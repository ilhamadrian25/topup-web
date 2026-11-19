import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyBillerResult } from "@/lib/orders";
import { toResult } from "./payterra";

/** Webhook lebih tua dari ini ditolak (docs/API.md: reject timestamps older than 5 minutes). */
const MAX_AGE_S = 300;

/**
 * Webhook Payterra Open API (docs/API.md "Webhooks"):
 *   X-Payterra-Event, X-Payterra-Event-Id, X-Payterra-Timestamp,
 *   X-Payterra-Signature = hex(HMAC-SHA256(webhook_secret, TIMESTAMP + "." + RAW_BODY))
 *   body { event, event_id, created_at, data: <transaction | deposit> }
 * Idempoten tanpa tabel dedupe: applyBillerResult hanya mengubah order yang masih PROCESSING,
 * jadi kiriman ulang / urutan acak tidak membalik status final.
 */
export async function handlePayterraWebhook(req: Request, secret: string | undefined): Promise<NextResponse> {
  if (!secret) return NextResponse.json({ message: "Webhook biller belum dikonfigurasi" }, { status: 503 });

  const raw = await req.text();
  const ts = req.headers.get("x-payterra-timestamp") ?? "";
  const sig = (req.headers.get("x-payterra-signature") ?? "").toLowerCase();
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!/^\d+$/.test(ts) || !(age <= MAX_AGE_S))
    return NextResponse.json({ message: "Timestamp tidak valid / kedaluwarsa" }, { status: 401 });
  const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });

  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Bad payload" }, { status: 400 });
  }
  const event = body.event ?? req.headers.get("x-payterra-event") ?? "";

  // ping / deposit.* tidak menyangkut order toko → cukup 2xx supaya tidak di-retry.
  if (!event.startsWith("transaction.")) return NextResponse.json({ ok: true, ignored: event || "unknown" });

  const tx = body.data as Parameters<typeof toResult>[0] | undefined;
  if (!tx?.ref_id || !["PENDING", "SUCCESS", "FAILED"].includes(tx.status))
    return NextResponse.json({ message: "Bad payload" }, { status: 400 });

  const order = await db.order.findUnique({ where: { billerRefId: tx.ref_id }, select: { id: true } });
  // 200 untuk ref_id tak dikenal supaya biller tidak retry tanpa henti.
  if (!order) return NextResponse.json({ ok: true, ignored: true });

  await applyBillerResult(order.id, toResult(tx));
  return NextResponse.json({ ok: true });
}
