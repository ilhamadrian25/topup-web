"use client";

import { useState } from "react";

export type DayPoint = { date: string; revenue: number; profit: number; count: number };

const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };
const BAR = "#ea580c"; // orange-600: ≥3:1 terhadap putih

function compact(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".0", "")}M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".0", "")}jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}rb`;
  return String(n);
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v)!;
}

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/** Omzet harian (bar, satu seri) dengan tooltip per hari. */
export function DailyChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.revenue)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const step = iw / data.length;
  const bw = Math.max(2, Math.min(28, step - 2)); // 2px celah antar bar
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / 8);
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grafik omzet harian">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * step + (step - bw) / 2;
          const top = y(d.revenue);
          const bh = PAD.top + ih - top;
          const r = Math.min(4, bw / 2, bh);
          return (
            <g key={d.date}>
              {hover === i && <rect x={PAD.left + i * step} y={PAD.top} width={step} height={ih} fill="#f97316" opacity={0.07} />}
              {bh > 0 && (
                <path
                  d={`M${x},${top + bh} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + bh} Z`}
                  fill={BAR}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={PAD.left + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7280">
                  {dayLabel(d.date)}
                </text>
              )}
              {/* hit area selebar kolom, lebih besar dari bar */}
              <rect
                x={PAD.left + i * step}
                y={PAD.top}
                width={step}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + ih} y2={PAD.top + ih} stroke="#d1d5db" />
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-line bg-white p-3 text-xs shadow-lg"
          style={{
            left: `${((PAD.left + hover * step + step / 2) / W) * 100}%`,
            transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})`,
          }}
        >
          <div className="mb-1.5 font-bold">{dayLabel(h.date)}</div>
          <div className="flex justify-between gap-2"><span className="text-muted">Omzet</span><span className="font-semibold">{rp(h.revenue)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted">Laba</span><span className="font-semibold">{rp(h.profit)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted">Transaksi</span><span className="font-semibold">{h.count}</span></div>
        </div>
      )}
    </div>
  );
}
