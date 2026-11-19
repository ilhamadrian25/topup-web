import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeBiller } from "@/lib/biller";
import { OrderError, parseAccount } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import type { InputField } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await rateLimit("account-check", 20, 60_000)))
    return NextResponse.json({ ok: false, message: "Terlalu banyak percobaan, tunggu sebentar" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const game = body?.gameSlug ? await db.game.findUnique({ where: { slug: String(body.gameSlug) } }) : null;
  if (!game?.isActive) return NextResponse.json({ ok: false, message: "Game tidak ditemukan" }, { status: 404 });
  if (!game.nicknameCheck) return NextResponse.json({ ok: false, message: "Cek akun tidak tersedia untuk game ini" }, { status: 400 });

  try {
    const account = parseAccount(game.inputFields as InputField[], body.account ?? {});
    const r = await (await activeBiller()).adapter.checkAccount({ brandCode: game.billerBrandCode, account });
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ ok: false, message: e.message }, { status: 400 });
    console.error("account-check", e);
    return NextResponse.json({ ok: false, message: "Layanan cek akun sedang gangguan" }, { status: 502 });
  }
}
