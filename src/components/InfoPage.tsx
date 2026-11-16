import Link from "next/link";

const NAV = [
  { href: "/terms", label: "Syarat & Ketentuan" },
  { href: "/refund-policy", label: "Kebijakan Refund" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Kontak" },
];

/** Kerangka halaman informasi/legal: judul, tanggal berlaku, navigasi antar halaman, isi ber-style prose. */
export function InfoPage({
  title,
  intro,
  updated,
  current,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={
              n.href === current
                ? "rounded-full bg-accent px-3 py-1.5 font-semibold text-accent-ink"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-muted hover:text-fg"
            }
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 text-muted">{intro}</p>}
      {updated && <p className="mt-1 text-xs text-muted">Terakhir diperbarui: {updated}</p>}
      <article className="card mt-6 space-y-4 p-5 text-sm leading-relaxed sm:p-7 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h2:first-child]:mt-0 [&_a]:text-accent [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ul]:list-disc [&_ul]:space-y-1.5">
        {children}
      </article>
    </div>
  );
}

/** Teks kontak ringkas untuk dipakai di dalam halaman legal. */
export function ContactLine({ email, phone, whatsapp }: { email: string; phone: string; whatsapp: string }) {
  const parts: React.ReactNode[] = [];
  if (email) parts.push(<a key="e" href={`mailto:${email}`}>{email}</a>);
  if (phone) parts.push(<a key="p" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>);
  if (whatsapp) parts.push(<a key="w" href={`https://wa.me/${whatsapp}`}>WhatsApp CS</a>);
  if (!parts.length) return <Link href="/contact">halaman Kontak</Link>;
  return <>{parts.flatMap((p, i) => (i ? [", ", p] : [p]))}</>;
}
