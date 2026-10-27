"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { addDays, dateShort, diffDays, monthShort, rupiahShort } from "@/lib/format";

// Warna seri lolos validator dataviz (lightness, chroma, CVD, kontras) di atas kartu putih.
const SALDO = "#5B4FCF";
const RENCANA = "#C9712A";
const GRID = "#e3e2ea"; // --color-line

const H = 200;
const PAD = { top: 12, right: 64, bottom: 24, left: 56 };

type Point = { date: string; value: number };

/** Nilai garis tangga pada `date`: titik terakhir yang tanggalnya tidak lewat dari `date`. */
function stepAt(points: Point[], date: string) {
  let v: number | null = null;
  for (const p of points) {
    if (p.date > date) break;
    v = p.value;
  }
  return v;
}

/** Batas atas sumbu Y yang bulat: 1, 2, 2,5, atau 5 kali pangkat sepuluh. */
function niceMax(v: number) {
  if (v <= 0) return 1_000_000;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${monthShort(m - 1)} ${String(y).slice(2)}`;
};

/**
 * Grafik saldo tabungan dibandingkan rencana. Keduanya garis tangga: saldo berubah di setiap transaksi,
 * rencana naik di awal setiap periode setoran. Tabel transaksi di bawahnya adalah tampilan datanya.
 */
export function SavingsChart({
  name,
  balance,
  plan,
  today,
}: {
  name: string;
  /** Saldo setelah tiap transaksi, urut tanggal, diawali saldo 0 di tanggal mulai. */
  balance: Point[];
  plan: Point[];
  today: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dates = [...balance, ...plan].map((p) => p.date);
  const x0 = dates.reduce((a, b) => (b < a ? b : a));
  // Saldo digambar sampai hari ini, jadi sumbu ikut panjang bila target sudah lewat.
  const x1 = [...dates, today].reduce((a, b) => (b > a ? b : a));
  const span = Math.max(1, diffDays(x0, x1));
  const yMax = niceMax(Math.max(...balance.map((p) => p.value), ...plan.map((p) => p.value)));
  const innerW = Math.max(0, w - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + (diffDays(x0, d) / span) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const balanceEnd = balance.at(-1)!.date > today ? balance.at(-1)!.date : today;
  const steps = (pts: Point[], end: string) => {
    let d = "";
    pts.forEach((p, i) => {
      d += i === 0 ? `M${x(p.date)},${y(p.value)}` : `H${x(p.date)}V${y(p.value)}`;
    });
    return d + `H${x(end)}`;
  };
  const saldoPath = steps(balance, balanceEnd);
  const planPath = steps(plan, plan.at(-1)!.date);
  const saldoArea = `${saldoPath}V${y(0)}H${x(balance[0].date)}Z`;

  // Tick bulan: paling banyak 5, mengikuti lebar grafik.
  const months: string[] = [];
  for (let d = x0.slice(0, 8) + "01"; d <= x1; ) {
    if (d >= x0) months.push(d);
    const [yy, mm] = d.split("-").map(Number);
    d = `${mm === 12 ? yy + 1 : yy}-${String((mm % 12) + 1).padStart(2, "0")}-01`;
  }
  const every = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor(innerW / 90))));
  const xTicks = months.filter((_, i) => i % every === 0);
  const yTicks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left - PAD.left) / innerW));
    setHover(addDays(x0, Math.round(t * span)));
  };
  // Panah kiri/kanan berpindah antartanggal transaksi dan awal periode rencana.
  const keyDates = [...new Set(dates)].sort();
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const cur = hover ?? (e.key === "ArrowRight" ? "" : "9999");
    const next = e.key === "ArrowRight" ? keyDates.find((d) => d > cur) : keyDates.findLast((d) => d < cur);
    if (next) setHover(next);
  };

  const hoverSaldo = hover && hover <= balanceEnd ? stepAt(balance, hover) : null;
  const hoverPlan = hover ? stepAt(plan, hover) : null;
  const last = balance.at(-1)!;
  const tipLeft = hover ? x(hover) > w / 2 : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: SALDO }} />
          Saldo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: RENCANA }} />
          Rencana
        </span>
      </div>
      <div ref={box} className="relative w-full" style={{ height: H }}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            role="img"
            aria-label={`Grafik saldo ${name} dibandingkan rencana. Saldo terakhir ${rupiahShort(last.value)}. Rincian ada di tabel transaksi.`}
            tabIndex={0}
            className="touch-pan-y outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ink"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
          >
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                  {v === 0 ? "0" : rupiahShort(v).replace("Rp ", "")}
                </text>
              </g>
            ))}
            {xTicks.map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">
                {monthLabel(d)}
              </text>
            ))}

            <path d={saldoArea} fill={SALDO} opacity={0.1} />
            <path d={planPath} fill="none" stroke={RENCANA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={saldoPath} fill="none" stroke={SALDO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Label akhir saldo: satu-satunya angka langsung di grafik. */}
            <circle cx={x(balanceEnd)} cy={y(last.value)} r={4} fill={SALDO} stroke="#fff" strokeWidth={2} />
            <text x={x(balanceEnd) + 8} y={y(last.value)} dy="0.32em" className="fill-ink text-[12px] font-bold tabular">
              {rupiahShort(last.value)}
            </text>

            {hover && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#5e5d70" strokeWidth={1} />
                {hoverPlan !== null && <circle cx={x(hover)} cy={y(hoverPlan)} r={4} fill={RENCANA} stroke="#fff" strokeWidth={2} />}
                {hoverSaldo !== null && <circle cx={x(hover)} cy={y(hoverSaldo)} r={4} fill={SALDO} stroke="#fff" strokeWidth={2} />}
              </g>
            )}
          </svg>
        )}
        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 flex min-w-[150px] flex-col gap-1 rounded-xl bg-ink px-3 py-2 text-[12px] text-white shadow-lg"
            style={tipLeft ? { right: w - x(hover) + 10 } : { left: x(hover) + 10 }}
          >
            <span className="font-bold">{dateShort(hover)}</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: SALDO }} />
              Saldo
              <span className="ml-auto pl-3 font-bold tabular">{hoverSaldo === null ? "Belum ada" : rupiahShort(hoverSaldo)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: RENCANA }} />
              Rencana
              <span className="ml-auto pl-3 font-bold tabular">{hoverPlan === null ? "Belum mulai" : rupiahShort(hoverPlan)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
