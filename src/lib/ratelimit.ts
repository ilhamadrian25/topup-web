import "server-only";
import { headers } from "next/headers";

// Fixed-window limiter in-memory. Cukup untuk single instance; ganti ke Redis
// jika aplikasi dijalankan multi-replica.
const g = globalThis as unknown as { rl?: Map<string, { n: number; reset: number }> };
const buckets = (g.rl ??= new Map());

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** true jika masih diizinkan. */
export async function rateLimit(name: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `${name}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.n++;
  return b.n <= limit;
}
