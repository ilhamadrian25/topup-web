/**
 * Scheduler internal: tiap menit memanggil /api/cron/sync-products di proses ini sendiri.
 * Route itu yang memutuskan apakah sync sudah waktunya (Pengaturan → Sync produk otomatis).
 * Lewat HTTP (bukan import langsung) supaya kode server-only tetap dibundel sebagai route biasa.
 * Matikan dengan DISABLE_INTERNAL_CRON=1 (mis. saat beberapa instance / pakai cron eksternal + CRON_SECRET).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.DISABLE_INTERNAL_CRON === "1") return;
  const g = globalThis as { __internalCronToken?: string; __internalCronTimer?: ReturnType<typeof setInterval> };
  if (g.__internalCronTimer) return;
  g.__internalCronToken = crypto.randomUUID();
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/sync-products`;
  const tick = async () => {
    try {
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${g.__internalCronToken}` }, signal: AbortSignal.timeout(120_000) });
      const body = (await res.json().catch(() => null)) as { ran?: boolean; summary?: string; error?: string } | null;
      if (body?.ran) console.log(`[auto-sync] ${body.summary}`);
      else if (!res.ok) console.error(`[auto-sync] HTTP ${res.status}: ${body?.error ?? ""}`);
    } catch (e) {
      console.error("[auto-sync]", e instanceof Error ? e.message : e);
    }
  };
  g.__internalCronTimer = setInterval(tick, 60_000);
  g.__internalCronTimer.unref?.();
}
