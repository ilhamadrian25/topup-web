/* eslint-disable @next/next/no-img-element */

function hue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Cover game. Foto/ikon (jpg/png) di-crop penuh; logo vektor (svg) ditaruh
 * di tengah dengan latar putih supaya tidak terpotong. Tanpa gambar:
 * gradient + inisial.
 */
export function GameCover({
  name,
  imageUrl,
  className = "",
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    const isVector = /\.svg(\?|$)/i.test(imageUrl);
    return isVector ? (
      <div className={`flex items-center justify-center bg-white ${className}`}>
        <img src={imageUrl} alt={name} className="h-[62%] w-[62%] object-contain" loading="lazy" />
      </div>
    ) : (
      <img src={imageUrl} alt={name} className={`object-cover ${className}`} loading="lazy" />
    );
  }
  const h = hue(name);
  return (
    <div
      aria-label={name}
      className={`flex items-center justify-center font-extrabold text-white/90 ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 50%), hsl(${(h + 50) % 360} 75% 35%))` }}
    >
      <span className="text-[clamp(1rem,30%,2.5rem)] drop-shadow">{initials(name)}</span>
    </div>
  );
}
