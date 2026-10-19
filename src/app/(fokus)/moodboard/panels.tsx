"use client";

import { useRef } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Maximize2 } from "lucide-react";
import type { MoodNode } from "@/db/schema";
import { MOOD_FILLS, MOOD_FONTS, MOOD_INK, type MoodFont } from "@/lib/moodboard";
import { cx, Input } from "@/components/kit";
import { ColorField } from "@/components/color-field";

export type InkStyle = { color: string; strokeWidth: number; fill?: string; font: MoodFont; fontSize: number };
type Patch = (p: Partial<MoodNode>) => void;

export function PanelHead({ label, onDone }: { label: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[13px] font-bold text-muted">{label}</h2>
      <button type="button" onClick={onDone} className="h-10 rounded-lg bg-ground px-3 text-[12px] font-bold hover:bg-[#e8e7ef]">
        Selesai
      </button>
    </div>
  );
}

export function TextField({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <Input type="text" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-auto h-11 rounded-xl border border-[#f1c9c4] text-[13px] font-bold text-danger hover:bg-[#fdf1ef]">
      {children}
    </button>
  );
}

export function Help({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold">{title}</div>
      <div className="text-muted">{children}</div>
    </div>
  );
}

/* ---------- Warna, ketebalan, isi ---------- */

export function ColorRow({ label, value, onChange, extra = [] }: { label: string; value: string; onChange: (hex: string) => void; extra?: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[12px] font-semibold text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {MOOD_INK.map((c) => (
          <Swatch key={c} color={c} on={value.toLowerCase() === c} onClick={() => onChange(c)} />
        ))}
      </div>
      <ColorField label={label} value={value} swatches={extra} onChange={onChange} />
    </fieldset>
  );
}

function Swatch({ color, on, onClick, label }: { color: string; on: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label ?? `Warna ${color.toUpperCase()}`}
      title={label ?? color.toUpperCase()}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-xl hover:bg-ground"
    >
      <span className={cx("size-7 rounded-full border", on ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink/15")} style={{ background: color }} />
    </button>
  );
}

const WIDTHS = [
  { v: 2, name: "Tipis" },
  { v: 4, name: "Sedang" },
  { v: 8, name: "Tebal" },
];

export function WidthRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[12px] font-semibold text-muted">Ketebalan</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ground p-1">
        {WIDTHS.map((w) => (
          <button
            key={w.v}
            type="button"
            aria-pressed={value === w.v}
            onClick={() => onChange(w.v)}
            className={cx("flex h-10 items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold", value === w.v ? "bg-ink text-white" : "hover:bg-surface")}
          >
            <span className="w-4 rounded-full bg-current" style={{ height: w.v }} aria-hidden="true" />
            {w.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FillRow({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[12px] font-semibold text-muted">Isi</legend>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(undefined)}
          className={cx("h-11 rounded-xl px-3 text-[12px] font-bold", !value ? "bg-ink text-white" : "bg-ground hover:bg-[#e8e7ef]")}
        >
          Kosong
        </button>
        {MOOD_FILLS.map((c) => (
          <Swatch key={c} color={c} on={value?.toLowerCase() === c} onClick={() => onChange(c)} label={`Isi ${c.toUpperCase()}`} />
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- Teks ---------- */

/** Pilihan font, tiap nama ditulis dengan font-nya sendiri supaya bisa dibandingkan langsung. */
export function FontPicker({ value, onChange }: { value: string; onChange: (f: MoodFont) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[12px] font-semibold text-muted">Font</legend>
      <div className="flex flex-col gap-1">
        {(Object.entries(MOOD_FONTS) as [MoodFont, (typeof MOOD_FONTS)[MoodFont]][]).map(([k, f]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cx(
              "flex min-h-11 items-center rounded-xl border px-3 text-left text-[19px] leading-tight",
              value === k ? "border-ink bg-ground" : "border-line hover:bg-sunken",
            )}
            style={{ fontFamily: f.css }}
          >
            {f.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TextPanel({ n, onChange, colors }: { n: MoodNode; onChange: Patch; colors: string[] }) {
  const align = n.align ?? "left";
  const size = n.fontSize ?? 24;
  const setSize = (v: number) => onChange({ fontSize: Math.min(200, Math.max(8, Math.round(v))) });
  return (
    <>
      <FontPicker value={n.font ?? "sans"} onChange={(font) => onChange({ font })} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mb-font-size" className="text-[12px] font-semibold text-muted">
          Ukuran huruf
        </label>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Perkecil huruf" onClick={() => setSize(size - 2)} className="size-11 shrink-0 rounded-xl bg-ground text-[16px] font-bold hover:bg-[#e8e7ef]">
            −
          </button>
          <Input
            id="mb-font-size"
            type="number"
            inputMode="numeric"
            min={8}
            max={200}
            value={size}
            onChange={(e) => e.target.value && setSize(Number(e.target.value))}
            className="min-w-0 flex-1 text-center tabular"
          />
          <button type="button" aria-label="Perbesar huruf" onClick={() => setSize(size + 2)} className="size-11 shrink-0 rounded-xl bg-ground text-[16px] font-bold hover:bg-[#e8e7ef]">
            +
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={n.weight === 700}
          aria-label="Tebal"
          title="Tebal"
          onClick={() => onChange({ weight: n.weight === 700 ? 400 : 700 })}
          className={cx("flex size-11 items-center justify-center rounded-xl", n.weight === 700 ? "bg-ink text-white" : "bg-ground hover:bg-[#e8e7ef]")}
        >
          <Bold size={18} aria-hidden="true" />
        </button>
        <div role="group" aria-label="Perataan" className="flex flex-1 gap-1 rounded-xl bg-ground p-1">
          {(
            [
              ["left", "Rata kiri", AlignLeft],
              ["center", "Rata tengah", AlignCenter],
              ["right", "Rata kanan", AlignRight],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={align === v}
              aria-label={label}
              title={label}
              onClick={() => onChange({ align: v })}
              className={cx("flex h-9 flex-1 items-center justify-center rounded-[10px]", align === v ? "bg-ink text-white" : "hover:bg-surface")}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <ColorRow label="Warna teks" value={n.color ?? "#1c1b29"} extra={colors} onChange={(color) => onChange({ color })} />
    </>
  );
}

export function StrokePanel({ n, onChange, colors }: { n: MoodNode; onChange: Patch; colors: string[] }) {
  const closed = n.type === "shape" && (n.shape === "rect" || n.shape === "ellipse");
  return (
    <>
      <ColorRow label={n.type === "draw" ? "Warna tinta" : "Warna garis"} value={n.color ?? "#1c1b29"} extra={colors} onChange={(color) => onChange({ color })} />
      <WidthRow value={n.strokeWidth ?? 3} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      {closed && <FillRow value={n.fill} onChange={(fill) => onChange({ fill })} />}
    </>
  );
}

/**
 * Bar pengaturan alat yang sedang aktif (pena, bentuk, teks): berlaku untuk elemen berikutnya
 * yang digambar, bukan untuk elemen yang sudah ada.
 */
export function ToolOptions({ tool, closedShape, style, onChange }: { tool: string; closedShape: boolean; style: InkStyle; onChange: (s: Partial<InkStyle>) => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Pengaturan alat"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-3 flex max-w-[calc(100%-200px)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-bar"
    >
      {MOOD_INK.map((c) => (
        <Swatch key={c} color={c} on={style.color === c} onClick={() => onChange({ color: c })} />
      ))}
      {tool !== "text" && (
        <>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          {WIDTHS.map((w) => (
            <button
              key={w.v}
              type="button"
              aria-pressed={style.strokeWidth === w.v}
              aria-label={`Garis ${w.name.toLowerCase()}`}
              title={`Garis ${w.name.toLowerCase()}`}
              onClick={() => onChange({ strokeWidth: w.v })}
              className={cx("flex size-11 items-center justify-center rounded-xl", style.strokeWidth === w.v ? "bg-ink text-white" : "hover:bg-ground")}
            >
              <span className="w-5 rounded-full bg-current" style={{ height: w.v }} aria-hidden="true" />
            </button>
          ))}
        </>
      )}
      {tool === "shape" && closedShape && (
        <>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={!!style.fill}
            onClick={() => onChange({ fill: style.fill ? undefined : MOOD_FILLS[2] })}
            className={cx("h-11 rounded-xl px-3 text-[12px] font-bold", style.fill ? "bg-ink text-white" : "hover:bg-ground")}
          >
            {style.fill ? "Berisi" : "Tanpa isi"}
          </button>
        </>
      )}
      {tool === "text" && (
        <>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          {(Object.entries(MOOD_FONTS) as [MoodFont, (typeof MOOD_FONTS)[MoodFont]][]).map(([k, f]) => (
            <button
              key={k}
              type="button"
              aria-pressed={style.font === k}
              aria-label={`Font ${f.name}`}
              title={f.name}
              onClick={() => onChange({ font: k })}
              className={cx("flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-[20px]", style.font === k ? "bg-ink text-white" : "hover:bg-ground")}
              style={{ fontFamily: f.css }}
            >
              Aa
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Foto ---------- */

/** Pengatur tampilan foto di panel detail: isi kartu atau utuh, dan titik fokus untuk mode isi kartu. */
export function PhotoAdjust({ n, src, onChange, onOpen }: { n: MoodNode; src: string; onChange: Patch; onOpen: () => void }) {
  const fit = n.fit ?? "cover";
  const fx = n.focus?.x ?? 50;
  const fy = n.focus?.y ?? 50;
  const dragging = useRef(false);
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
  const setFrom = (el: HTMLElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    onChange({ focus: { x: clamp(((clientX - r.left) / r.width) * 100), y: clamp(((clientY - r.top) / r.height) * 100) } });
  };
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onOpen} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]">
        <Maximize2 size={16} aria-hidden="true" />
        Lihat foto penuh
      </button>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[12px] font-semibold text-muted">Tampilan di kartu</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1">
          {(
            [
              ["cover", "Isi kartu"],
              ["contain", "Utuh"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={fit === v}
              onClick={() => onChange({ fit: v })}
              className={cx("h-10 rounded-[10px] text-[13px] font-bold transition-colors duration-150", fit === v ? "bg-ink text-white" : "hover:bg-surface")}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {fit === "cover" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-8 items-center justify-between">
            <span id="mb-focus-label" className="text-[12px] font-semibold text-muted">
              Titik fokus
            </span>
            {(fx !== 50 || fy !== 50) && (
              <button type="button" onClick={() => onChange({ focus: undefined })} className="hit-44 h-8 rounded-lg px-2 text-[12px] font-semibold underline underline-offset-2">
                Tengahkan
              </button>
            )}
          </div>
          <div
            tabIndex={0}
            role="group"
            aria-roledescription="pengatur titik fokus"
            aria-labelledby="mb-focus-label"
            aria-describedby="mb-focus-help"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setFrom(e.currentTarget, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (dragging.current) setFrom(e.currentTarget, e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onKeyDown={(e) => {
              const d: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] };
              if (!d[e.key]) return;
              e.preventDefault();
              onChange({ focus: { x: clamp(fx + d[e.key][0]), y: clamp(fy + d[e.key][1]) } });
            }}
            className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-xl bg-ground"
          >
            {/* Pratinjau memakai foto utuh, jadi posisi titik sama persis dengan bagian foto yang dipilih. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" draggable={false} className="pointer-events-none block h-auto w-full" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink/60 shadow-[0_0_0_1px_rgba(28,27,41,0.5)]"
              style={{ left: `${fx}%`, top: `${fy}%` }}
            />
          </div>
          <p id="mb-focus-help" className="text-[12px] text-muted">
            Klik atau seret ke bagian foto yang paling penting. Tombol panah menggeser 5%. Sekarang {fx}% dari kiri, {fy}% dari atas.
          </p>
        </div>
      )}
    </div>
  );
}
