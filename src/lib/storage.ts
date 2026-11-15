import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Penyimpanan upload gambar admin. Dua driver, dipilih otomatis:
 * - Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY diisi): untuk
 *   hosting tanpa disk persisten (Vercel). File disajikan langsung dari URL
 *   publik bucket SUPABASE_STORAGE_BUCKET (default "uploads", harus public).
 * - Disk lokal (UPLOAD_DIR, default ./uploads), disajikan lewat
 *   /uploads/[...path]. Di server sendiri, mount UPLOAD_DIR ke volume persisten.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
const supabaseEnabled = () => !!SUPABASE_URL && !!SUPABASE_KEY;

async function putSupabase(objectPath: string, buf: Buffer, mime: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, "Content-Type": mime, "Cache-Control": "31536000", "x-upsert": "false" },
    body: new Uint8Array(buf),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new UploadError(`Upload ke Supabase Storage gagal (HTTP ${res.status})`);
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectPath}`;
}
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// SVG sengaja tidak diizinkan: bisa berisi script.
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]));

export class UploadError extends Error {}

function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).toString() === "GIF8") return "image/gif";
  return null;
}

/** Simpan file gambar dan kembalikan URL publiknya. */
export async function saveImage(file: File, folder: "games" | "banners" | "payments" | "store"): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Ukuran gambar maksimal 2 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  // Percayai isi file, bukan nama/Content-Type dari browser.
  const mime = sniff(buf);
  if (!mime) throw new UploadError("Format gambar harus PNG, JPG, WEBP, atau GIF");
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${TYPES[mime]}`;
  if (supabaseEnabled()) return putSupabase(`${folder}/${name}`, buf, mime);
  const dir = path.join(UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${folder}/${name}`;
}

/** Baca file upload; null jika path tidak valid / tidak ada. */
export async function readUpload(parts: string[]): Promise<{ data: Buffer; mime: string } | null> {
  if (parts.length !== 2 || parts.some((p) => !/^[a-z0-9-]+(\.[a-z0-9]+)?$/i.test(p))) return null;
  const full = path.join(UPLOAD_DIR, ...parts);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return null;
  const mime = MIME_BY_EXT[parts[1]!.split(".").pop()!.toLowerCase()];
  if (!mime) return null;
  try {
    return { data: await readFile(full), mime };
  } catch {
    return null;
  }
}

/**
 * Ambil nilai URL gambar dari form: file baru (field `${name}File`) menang atas
 * URL teks (field `${name}`); checkbox `${name}Remove` mengosongkan.
 */
export async function imageFromForm(fd: FormData, name: string, folder: Parameters<typeof saveImage>[1]): Promise<string | null> {
  if (fd.get(`${name}Remove`) === "on") return null;
  const f = fd.get(`${name}File`);
  if (f instanceof File && f.size > 0) return saveImage(f, folder);
  const url = String(fd.get(name) ?? "").trim();
  return url || null;
}
