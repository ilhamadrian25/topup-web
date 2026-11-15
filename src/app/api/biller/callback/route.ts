import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyBillerResult } from "@/lib/orders";

/**
 * Callback status transaksi dari Payterra (kontrak yang diusulkan, lihat
 * docs/payterra-merchant-api.md). Signature: hex HMAC-SHA256 dari raw body
 * dengan PAYTERRA_CALLBACK_SECRET, di header X-Payterra-Signature.
 */
export async function POST(req: Request) {
  const secret = process.env.PAYTERRA_CALLBACK_SECRET;
  if (!secret) return NextResponse.json({ message: "Callback belum dikonfigurasi" }, { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get("x-payterra-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });

  const body = JSON.parse(raw) as { refId?: string; status?: string; billerRef?: string; sn?: string; message?: string };
  if (!body.refId || !["PENDING", "SUCCESS", "FAILED"].includes(body.status ?? ""))
    return NextResponse.json({ message: "Bad payload" }, { status: 400 });

  const order = await db.order.findUnique({ where: { billerRefId: body.refId }, select: { id: true } });
  // 200 untuk refId tak dikenal supaya biller tidak retry tanpa henti.
  if (!order) return NextResponse.json({ ok: true, ignored: true });

  await applyBillerResult(order.id, {
    status: body.status as "PENDING" | "SUCCESS" | "FAILED",
    billerRef: body.billerRef,
    sn: body.sn,
    message: body.message ?? "",
  });
  return NextResponse.json({ ok: true });
}
