import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runProductSync, runProductSyncIfDue, syncSummary } from "@/lib/product-sync";

export const dynamic = "force-dynamic";

/**
 * Sync produk/harga dari biller, dipanggil berkala oleh scheduler internal (src/instrumentation.ts)
 * atau cron eksternal: `Authorization: Bearer <CRON_SECRET>`.
 * Default hanya jalan bila sudah waktunya (Pengaturan → interval sync otomatis); `?force=1` = jalan sekarang.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const r = force ? await runProductSync("auto") : await runProductSyncIfDue();
    return NextResponse.json(r ? { ok: true, ran: true, summary: syncSummary(r), repriced: r.repriced } : { ok: true, ran: false });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export const GET = POST;

function authorized(req: Request): boolean {
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const tokens = [process.env.CRON_SECRET, (globalThis as { __internalCronToken?: string }).__internalCronToken];
  return tokens.some((t) => !!t && t.length === got.length && timingSafeEqual(Buffer.from(t), Buffer.from(got)));
}
