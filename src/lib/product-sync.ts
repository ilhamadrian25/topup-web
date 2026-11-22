import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { activeBiller } from "./biller";
import { syncProducts, type SyncReport } from "./catalog";
import { getSettings } from "./settings";

/** Hasil sync terakhir, disimpan di tabel Setting (key LAST_SYNC_KEY) untuk ditampilkan di admin. */
export type LastSync = {
  at: string;
  source: "auto" | "manual";
  ok: boolean;
  message: string;
};

const LAST_SYNC_KEY = "lastProductSync";

const g = globalThis as unknown as { productSyncRunning?: Promise<SyncReport> };

export function syncSummary(r: SyncReport): string {
  let msg = `${r.created} baru, ${r.updated} diperbarui, ${r.repriced.length} harga berubah, ${r.unavailable} tidak tersedia`;
  if (r.unknownBrands.length) msg += `. Brand belum punya game: ${r.unknownBrands.join(", ")}`;
  return msg;
}

export async function getLastSync(): Promise<LastSync | null> {
  const row = await db.setting.findUnique({ where: { key: LAST_SYNC_KEY } });
  return (row?.value as LastSync | undefined) ?? null;
}

/**
 * Sync produk dari biller aktif dan catat hasilnya. Satu sync berjalan sekaligus per proses:
 * pemanggil kedua ikut menunggu sync yang sedang jalan.
 */
export async function runProductSync(source: LastSync["source"]): Promise<SyncReport> {
  if (g.productSyncRunning) return g.productSyncRunning;
  const run = (async () => {
    try {
      const s = await getSettings();
      const { adapter } = await activeBiller();
      const r = await syncProducts(db, adapter, s);
      await saveLastSync({ at: new Date().toISOString(), source, ok: true, message: syncSummary(r) });
      if (r.created || r.updated || r.unavailable) revalidatePath("/", "layout");
      return r;
    } catch (e) {
      await saveLastSync({ at: new Date().toISOString(), source, ok: false, message: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  })();
  g.productSyncRunning = run;
  try {
    return await run;
  } finally {
    g.productSyncRunning = undefined;
  }
}

/** Sync otomatis bila sudah waktunya (interval dari pengaturan). Mengembalikan null bila belum waktunya / dimatikan. */
export async function runProductSyncIfDue(): Promise<SyncReport | null> {
  const { autoSyncMinutes } = await getSettings();
  if (!autoSyncMinutes || autoSyncMinutes <= 0) return null;
  const last = await getLastSync();
  // Sync gagal dicoba lagi lebih cepat (maks tiap 5 menit) supaya tidak menunggu satu interval penuh.
  const wait = (last && !last.ok ? Math.min(5, autoSyncMinutes) : autoSyncMinutes) * 60_000;
  if (last && Date.now() - new Date(last.at).getTime() < wait - 30_000) return null;
  return runProductSync("auto");
}

async function saveLastSync(v: LastSync) {
  await db.setting.upsert({ where: { key: LAST_SYNC_KEY }, create: { key: LAST_SYNC_KEY, value: v }, update: { value: v } });
}
