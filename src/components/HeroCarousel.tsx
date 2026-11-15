"use client";

import { ChevronLeft, ChevronRight, Gamepad2, Gem, Gift, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Slide = { id: string; title: string; subtitle: string | null; imageUrl: string | null; linkUrl: string | null };

const BG = [
  "linear-gradient(115deg, #f97316 0%, #fb923c 40%, #fdba74 100%)",
  "linear-gradient(115deg, #7c3aed 0%, #a855f7 50%, #f0abfc 100%)",
  "linear-gradient(115deg, #0284c7 0%, #38bdf8 55%, #a5f3fc 100%)",
  "linear-gradient(115deg, #059669 0%, #34d399 55%, #bbf7d0 100%)",
];

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => !paused.current && go(1), 5000);
    return () => clearInterval(t);
  }, [go, n]);

  if (!n) return null;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <Link
            key={s.id}
            href={s.linkUrl || "#"}
            className="relative flex aspect-[16/7] w-full shrink-0 items-end overflow-hidden p-6 sm:aspect-[16/5.5] sm:p-10"
            style={
              s.imageUrl
                ? { backgroundImage: `url(${s.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: BG[k % BG.length] }
            }
          >
            {!s.imageUrl && (
              <>
                <div className="absolute -top-16 -right-10 h-64 w-64 rounded-full bg-white/15" />
                <div className="absolute right-24 -bottom-24 h-56 w-56 rounded-full bg-white/10" />
                {(() => {
                  const Icon = [Gem, Gamepad2, Zap, Gift][k % 4];
                  return <Icon className="absolute top-1/2 right-12 hidden h-40 w-40 -translate-y-1/2 rotate-12 text-white/85 drop-shadow-xl sm:block" strokeWidth={1.4} />;
                })()}
              </>
            )}
            <div className="relative max-w-lg text-white">
              <h2 className="text-2xl leading-tight font-black drop-shadow sm:text-4xl">{s.title}</h2>
              {s.subtitle && <p className="mt-2 text-sm font-medium text-white/90 sm:text-base">{s.subtitle}</p>}
            </div>
          </Link>
        ))}
      </div>
      {n > 1 && (
        <>
          {[-1, 1].map((d) => (
            <button
              key={d}
              aria-label={d < 0 ? "Sebelumnya" : "Berikutnya"}
              onClick={() => go(d)}
              className={`absolute top-1/2 ${d < 0 ? "left-3" : "right-3"} flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg font-bold text-fg opacity-0 shadow transition group-hover:opacity-100`}
            >
              {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          ))}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, k) => (
              <button
                key={s.id}
                aria-label={`Slide ${k + 1}`}
                onClick={() => setI(k)}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
