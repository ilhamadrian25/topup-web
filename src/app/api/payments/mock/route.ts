import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mockAllowed } from "@/lib/payment";
import { markOrderPaid, OrderError } from "@/lib/orders";

/** Simulasi "pembayaran berhasil" — hanya untuk order yang tagihannya dibuat oleh gateway MOCK. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const invoice = String(body?.invoice ?? "");
  const order = await db.order.findUnique({ where: { invoice }, select: { paymentGateway: { select: { provider: true } } } });
  if (!mockAllowed() || order?.paymentGateway?.provider !== "MOCK")
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  try {
    await markOrderPaid(invoice, { source: "mock" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ message: e.message }, { status: 400 });
    console.error("mock pay", e);
    return NextResponse.json({ message: "Gagal" }, { status: 500 });
  }
}
