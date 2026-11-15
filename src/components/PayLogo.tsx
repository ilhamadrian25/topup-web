/* eslint-disable @next/next/no-img-element */

/** Logo metode pembayaran dalam kotak putih seragam; fallback ke kode teks. */
export function PayLogo({
  name,
  code,
  imageUrl,
  className = "h-8 w-14",
}: {
  name: string;
  code: string;
  imageUrl?: string | null;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md border border-line bg-white px-1.5 ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="max-h-[70%] max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="text-[9px] font-black tracking-tight text-muted uppercase">{code}</span>
      )}
    </span>
  );
}
