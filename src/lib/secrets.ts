import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Enkripsi kredensial gateway yang disimpan di DB (AES-256-GCM).
 * Kunci = SHA-256 dari CONFIG_ENCRYPTION_KEY (fallback AUTH_SECRET).
 * Mengganti kunci membuat kredensial lama tidak terbaca → isi ulang di admin.
 */
function key(): Buffer {
  const k = process.env.CONFIG_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!k || k.length < 32) throw new Error("CONFIG_ENCRYPTION_KEY / AUTH_SECRET minimal 32 karakter");
  return createHash("sha256").update(k).digest();
}

export function encryptJson(value: Record<string, string>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptJson(blob: string | null | undefined): Record<string, string> {
  if (!blob) return {};
  const [v, iv, tag, ct] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Format secret tidak dikenal");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8"));
}

/** Untuk tampilan admin: "abcd••••wxyz". */
export function mask(s: string | undefined): string {
  if (!s) return "";
  return s.length <= 8 ? "••••" : `${s.slice(0, 4)}••••${s.slice(-4)}`;
}
