import { NextResponse } from "next/server";
import { getPublicOrder, refreshOrder } from "@/lib/orders";

export async function GET(_req: Request, { params }: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await params;
  await refreshOrder(invoice);
  const order = await getPublicOrder(invoice);
  if (!order) return NextResponse.json({ message: "Invoice tidak ditemukan" }, { status: 404 });
  return NextResponse.json(order, { headers: { "Cache-Control": "no-store" } });
}
