/** Logo toko: lencana petir oranye + wordmark. */
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
      <path d="M22.5 6 11 22.5h7.5L16.5 34 29 17h-7.6z" fill="#fff" />
    </svg>
  );
}

/* eslint-disable @next/next/no-img-element */
export function Logo({ name, logoUrl, className = "" }: { name: string; logoUrl?: string | null; className?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {logoUrl ? <img src={logoUrl} alt={name} className="h-9 w-9 rounded-xl object-contain" /> : <LogoMark />}
      <span className="hidden text-lg leading-none font-black tracking-tight uppercase italic sm:inline">
        {first}
        {rest.length > 0 && <span className="text-accent"> {rest.join(" ")}</span>}
      </span>
    </span>
  );
}
