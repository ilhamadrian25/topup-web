/** Path huruf "T" Topupin yang batangnya berbentuk petir (viewBox 40×40). Sama dengan src/app/icon.svg. */
const T_BOLT =
  "M9.5 9.5h21a2 2 0 0 1 2 2v2.6a2 2 0 0 1-2 2H24.3L21.6 22h5.2a1 1 0 0 1 .8 1.6L16.4 35.2c-.6.7-1.7.1-1.4-.8l2.6-8.6h-3.9a1 1 0 0 1-.9-1.4L15.9 16.1H9.5a2 2 0 0 1-2-2v-2.6a2 2 0 0 1 2-2z";

/** Logo bawaan: lencana oranye dengan "T" petir. Diganti logo upload dari Admin → Pengaturan bila diisi. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lg-bg)" />
      <path d={T_BOLT} fill="#fff" />
    </svg>
  );
}

/**
 * Pisah nama jadi [utama, aksen] untuk wordmark dua warna:
 * "Topupin" → "Topup" + "in" (tanpa spasi); "Payterra Top Up" → "Payterra" + " Top Up".
 */
function splitWordmark(name: string): [string, string] {
  const m = name.match(/^(top\s?up)(\S.*)$/i);
  if (m) return [m[1], m[2]];
  const i = name.indexOf(" ");
  return i < 0 ? [name, ""] : [name.slice(0, i), name.slice(i)];
}

/* eslint-disable @next/next/no-img-element */
export function Logo({ name, logoUrl, className = "" }: { name: string; logoUrl?: string | null; className?: string }) {
  const [first, accent] = splitWordmark(name);
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {logoUrl ? <img src={logoUrl} alt={name} className="h-9 w-9 rounded-xl object-contain" /> : <LogoMark />}
      <span className="hidden text-lg leading-none font-black tracking-tight whitespace-pre uppercase italic sm:inline">
        {first}
        {accent && <span className="text-accent">{accent}</span>}
      </span>
    </span>
  );
}
