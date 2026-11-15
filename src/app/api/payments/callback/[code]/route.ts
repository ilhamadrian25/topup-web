import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gatewayAdapter } from "@/lib/payment";
import { OrderError, syncGatewayPayment } from "@/lib/orders";

/**
 * Callback (notifyUrl) dari payment gateway: /api/payments/callback/{gateway.code}.
 * Isi body hanya dipakai untuk tahu transaksi mana; status & nominal selalu
 * diverifikasi ulang ke API gateway sebelum order ditandai lunas.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gw = await db.paymentGateway.findUnique({ where: { code } });
  if (!gw || gw.provider === "MOCK") return NextResponse.json({ message: "Not found" }, { status: 404 });

  const type = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    body = type.includes("application/json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ message: "Body tidak valid" }, { status: 400 });
  }

  const cb = gatewayAdapter(gw).parseCallback(body);
  if (!cb) return NextResponse.json({ message: "Data callback tidak lengkap" }, { status: 400 });

  const order = await db.order.findUnique({ where: { invoice: cb.invoice }, select: { paymentGatewayId: true } });
  // 200 supaya gateway berhenti retry untuk invoice yang memang bukan milik gateway ini.
  if (!order || order.paymentGatewayId !== gw.id) return NextResponse.json({ ok: false, message: "Invoice tidak dikenal" });

  try {
    const status = await syncGatewayPayment(cb.invoice, cb.transactionId);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ ok: false, message: e.message });
    console.error("payment callback", code, e);
    // 5xx → gateway akan mengirim ulang callback.
    return NextResponse.json({ message: "Gagal memproses" }, { status: 500 });
  }
}
