export function rupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function dateTime(d: Date | string): string {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normalisasi nomor WhatsApp ke format 62xxxxxxxx. Null jika tidak valid. */
export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return /^628\d{7,12}$/.test(p) ? p : null;
}

export function maskPhone(p: string): string {
  return p.length > 7 ? p.slice(0, 5) + "****" + p.slice(-3) : p;
}
