import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, OrderError } from "@/lib/orders";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  gameSlug: z.string().min(1),
  productId: z.string().min(1),
  account: z.record(z.string(), z.unknown()).default({}),
  paymentMethodCode: z.string().min(1),
  phone: z.string().min(8).max(20),
  email: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  if (!(await rateLimit("orders", 10, 60_000)))
    return NextResponse.json({ message: "Terlalu banyak permintaan, tunggu sebentar" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Data order tidak lengkap" }, { status: 400 });

  const session = await getSession();
  try {
    const invoice = await createOrder({ ...parsed.data, userId: session?.sub ?? null });
    return NextResponse.json({ invoice });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ message: e.message }, { status: 400 });
    console.error("create order", e);
    return NextResponse.json({ message: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
