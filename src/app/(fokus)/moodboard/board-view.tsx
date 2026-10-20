"use client";

// Tampilan elemen papan yang dipakai editor moodboard dan halaman baca-saja untuk vendor (/m/[token]).
// Tidak ada logika edit di sini: editor membungkus komponen ini dengan pegangan dan event pointer.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { MoodData, MoodEdge, MoodMedia, MoodNode } from "@/db/schema";
import { cleanParents, MOOD_FONTS, sourceName, type MoodFont, type MoodRect } from "@/lib/moodboard";
import { cx } from "@/components/kit";
import { Modal } from "@/components/forms";
import { BrandingCard } from "@/components/ui/color-palette";
import { smoothPath } from "./ink";

export const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  photo: { w: 240, h: 222 },
  note: { w: 220, h: 132 },
  palette: { w: 260, h: 236 },
  text: { w: 240, h: 40 },
  shape: { w: 160, h: 120 },
  draw: { w: 40, h: 40 },
  media: { w: 260, h: 312 },
  frame: { w: 400, h: 300 },
};

// Tinggi baris judul di bawah foto kartu media. Sisa tinggi kartu mengikuti rasio foto pertama.
export const MEDIA_FOOTER = 52;
/** Tinggi dibagi lebar foto atau video pertama di kartu media. */
export function mediaRatio(n: MoodNode) {
  const m = n.media?.[0];
  return m?.w && m.h ? m.h / m.w : 1;
}

/** Kotak elemen di koordinat papan. Tinggi teks mengikuti isinya, jadi diukur dari DOM bila ada. */
export function boxOf(n: MoodNode, textH?: number): MoodRect {
  const d = DEFAULT_SIZE[n.type] ?? DEFAULT_SIZE.shape;
  const w = n.w ?? d.w;
  if (n.type === "media") return { x: n.x, y: n.y, w, h: n.h ?? Math.round(w * mediaRatio(n)) + MEDIA_FOOTER };
  const h = n.type === "text" ? (textH ?? n.h ?? Math.round((n.fontSize ?? 24) * 1.3)) : (n.h ?? d.h);
  return { x: n.x, y: n.y, w, h };
}

export function insideRect(b: MoodRect, g: MoodRect) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h;
}

export function overlaps(a: MoodRect, b: MoodRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Kurva bezier dari sisi kotak A ke sisi kotak B (atau ke titik kursor, kotak berukuran nol). */
export function curve(a: MoodRect, b: MoodRect) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  let p0, p3, c1, c2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = dx >= 0 ? 1 : -1;
    p0 = { x: ax + (s * a.w) / 2, y: ay };
    p3 = { x: bx - (s * b.w) / 2, y: by };
    const o = Math.max(40, Math.abs(p3.x - p0.x) / 2);
    c1 = { x: p0.x + s * o, y: p0.y };
    c2 = { x: p3.x - s * o, y: p3.y };
  } else {
    const s = dy >= 0 ? 1 : -1;
    p0 = { x: ax, y: ay + (s * a.h) / 2 };
    p3 = { x: bx, y: by - (s * b.h) / 2 };
    const o = Math.max(40, Math.abs(p3.y - p0.y) / 2);
    c1 = { x: p0.x, y: p0.y + s * o };
    c2 = { x: p3.x, y: p3.y - s * o };
  }
  return {
    d: `M${p0.x} ${p0.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p3.x} ${p3.y}`,
    mx: (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8,
    my: (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8,
  };
}

/* ---------- Frame ---------- */

/**
 * Urutan gambar elemen: yang langsung di kanvas menurut urutan daftar, dan isi frame digambar
 * tepat setelah frame-nya. Jadi isi frame selalu di atas latar frame, apa pun urutannya di daftar.
 */
export function drawOrder(nodes: MoodNode[]) {
  const kids = new Map<string | undefined, MoodNode[]>();
  for (const n of cleanParents(nodes)) {
    const list = kids.get(n.parent) ?? [];
    list.push(n);
    kids.set(n.parent, list);
  }
  const out: MoodNode[] = [];
  const walk = (p?: string) => {
    for (const n of kids.get(p) ?? []) {
      out.push(n);
      if (n.type === "frame") walk(n.id);
    }
  };
  walk(undefined);
  return out;
}

/** Rantai frame di atas elemen, dari yang terdekat. */
export function ancestors(n: MoodNode, byId: Map<string, MoodNode>) {
  const out: MoodNode[] = [];
  let p = n.parent;
  while (p && out.length < 50) {
    const f = byId.get(p);
    if (!f || out.includes(f)) break;
    out.push(f);
    p = f.parent;
  }
  return out;
}

/** Area tempat elemen boleh terlihat: irisan semua frame di atasnya yang memotong isi. Null = tidak dipotong. */
export function frameClip(n: MoodNode, byId: Map<string, MoodNode>, box: (n: MoodNode) => MoodRect): MoodRect | null {
  let r: MoodRect | null = null;
  for (const f of ancestors(n, byId)) {
    if (f.clip === false) continue;
    const b = box(f);
    if (!r) r = b;
    else {
      const x = Math.max(r.x, b.x);
      const y = Math.max(r.y, b.y);
      r = { x, y, w: Math.max(0, Math.min(r.x + r.w, b.x + b.w) - x), h: Math.max(0, Math.min(r.y + r.h, b.y + b.h) - y) };
    }
  }
  return r;
}

/** clip-path untuk elemen di kotak `b` supaya hanya bagian di dalam `r` yang terlihat. Undefined bila tidak ada yang terpotong. */
export function clipPath(b: MoodRect, r: MoodRect | null) {
  if (!r || (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h)) return undefined;
  const x0 = r.x - b.x;
  const y0 = r.y - b.y;
  return `polygon(${x0}px ${y0}px, ${x0 + r.w}px ${y0}px, ${x0 + r.w}px ${y0 + r.h}px, ${x0}px ${y0 + r.h}px)`;
}

/** Latar frame dan namanya di atas sudut kiri. Ukuran nama tetap di layar, berapa pun zoom-nya. */
export function FrameBody({ n, zoom }: { n: MoodNode; zoom: number }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: n.fill ?? "#ffffff" }} />
      <div
        data-frame-label=""
        className="absolute bottom-full left-0 max-w-full truncate whitespace-nowrap font-semibold text-muted"
        style={{ fontSize: 12 / zoom, paddingBottom: 4 / zoom }}
      >
        {n.title || "Frame"}
      </div>
    </>
  );
}

/** Elemen yang dipakai sebagai kartu (bisa disambung, punya judul dan tag). */
export const isCard = (n: MoodNode) => n.type === "photo" || n.type === "note" || n.type === "palette" || n.type === "media";
/** Elemen yang hanya bisa dipilih lewat garisnya, bukan lewat kotak pembatasnya. */
export const isStroke = (n: MoodNode) => n.type === "draw" || (n.type === "shape" && (n.shape === "line" || n.shape === "arrow"));

export const fontCss = (f?: string) => (MOOD_FONTS[f as MoodFont] ?? MOOD_FONTS.sans).css;

export const photoStyle = (n: MoodNode) => ({
  objectFit: n.fit ?? "cover",
  objectPosition: `${n.focus?.x ?? 50}% ${n.focus?.y ?? 50}%`,
});

/* ---------- Kartu ---------- */

/** Luminans relatif (WCAG) dari hex 6 digit. */
function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * Kartu palet memakai BrandingCard dari 21st.dev. "Aa" ditulis dengan warna tergelap di palet
 * sebagai pratinjau warna teks; bila warna itu terlalu terang di atas putih (< 3:1), dipakai ink.
 */
export function PaletteCard({ n }: { n: MoodNode }) {
  const colors = n.swatches ?? [];
  const darkest = [...colors].sort((a, b) => luminance(a) - luminance(b))[0];
  const readable = darkest && 1.05 / (luminance(darkest) + 0.05) >= 3;
  return (
    <BrandingCard
      animated={false}
      category="Palet warna"
      categoryClassName="mb-2 text-[12px] font-semibold normal-case tracking-normal text-muted"
      title={n.title || "Tanpa judul"}
      subtitle={colors.length ? `${colors.length} warna` : "Belum ada warna"}
      displayElement={<span style={{ color: readable ? darkest : "#1c1b29" }}>Aa</span>}
      colors={colors.length ? colors : ["#e8e7ef"]}
      className="h-full max-w-none rounded-2xl border-0 bg-transparent shadow-none hover:shadow-none"
    />
  );
}

export function PhotoCard({
  n,
  src,
  uploading,
  showOpen,
  onOpen,
}: {
  n: MoodNode;
  src: string | null;
  uploading?: boolean;
  showOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative min-h-0 flex-1 bg-[#e8e7ef]">
        {src ? (
          // Foto dari penyimpanan privat lewat route berizin, jadi tidak lewat optimasi next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={n.title} draggable={false} className="pointer-events-none block size-full" style={photoStyle(n)} />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] font-semibold text-muted">{uploading ? "" : "Foto belum ada"}</div>
        )}
        {uploading && <span className="absolute bottom-2 left-2 rounded-md bg-ink px-2 py-[3px] text-[11px] font-bold text-white">Mengunggah…</span>}
        {src && (
          <button
            type="button"
            data-ui=""
            aria-label={`Lihat foto ${n.title} penuh`}
            title="Lihat foto penuh (atau klik dua kali kartu)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onOpen}
            className={cx(
              "absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg bg-ink/80 text-white transition-opacity duration-150 hover:bg-ink",
              showOpen ? "opacity-100" : "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100",
            )}
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 shrink-0 flex-col gap-1.5 px-3 py-2.5">
        <div className="shrink-0 truncate text-[13px] font-bold leading-[1.4]">{n.title || "Tanpa judul"}</div>
        <div className="flex h-[19px] shrink-0 gap-1 overflow-hidden">
          {n.tags.slice(0, 3).map((t) => (
            <span key={t} className="whitespace-nowrap rounded-md bg-ground px-[7px] py-0.5 text-[11px] font-semibold">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Kartu dari link (Instagram, Pinterest, dll.). Foto tampil utuh tanpa terpotong; kartu dibuat dengan
 * rasio foto pertama, isi carousel lain yang rasionya berbeda diberi latar. Carousel bisa digeser ke
 * kiri dan kanan saat `swipe` aktif (di editor: setelah kartu dipilih, supaya kartu tetap bisa
 * dipindah), atau lewat tombol panah. Video diputar langsung di kartu.
 */
export function MediaCard({
  n,
  src,
  swipe,
  showOpen,
  onOpen,
}: {
  n: MoodNode;
  src: (fileId: string) => string;
  swipe: boolean;
  showOpen: boolean;
  onOpen: () => void;
}) {
  const items = n.media ?? [];
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; id: number; scale: number } | null>(null);
  const cur = Math.min(index, items.length - 1);
  const many = items.length > 1;
  const go = (d: number) => setIndex(Math.max(0, Math.min(items.length - 1, cur + d)));
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const end = (e: ReactPointerEvent) => {
    const s = start.current;
    if (s?.id !== e.pointerId) return;
    start.current = null;
    setDx(0);
    const d = (e.clientX - s.x) / s.scale;
    if (Math.abs(d) > 40) go(d < 0 ? 1 : -1);
  };
  const reveal = showOpen ? "opacity-100" : "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100";
  const arrow = cx(
    "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-bar transition-opacity duration-150 hover:bg-surface",
    reveal,
  );
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl">
      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-[#e8e7ef]"
        onPointerDown={
          swipe && many
            ? (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                const el = e.currentTarget;
                el.setPointerCapture(e.pointerId);
                // Kartu bisa sedang di-zoom: jarak geser dihitung di ukuran kartu, bukan ukuran layar.
                start.current = { x: e.clientX, id: e.pointerId, scale: el.getBoundingClientRect().width / el.offsetWidth || 1 };
              }
            : undefined
        }
        onPointerMove={(e) => {
          const s = start.current;
          if (s?.id === e.pointerId) setDx((e.clientX - s.x) / s.scale);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className={cx("flex h-full", !dx && "transition-transform duration-200 ease-out")} style={{ transform: `translateX(calc(${-cur * 100}% + ${dx}px))` }}>
          {items.map((m, j) => (
            <div key={m.fileId} className="relative h-full w-full shrink-0">
              {m.kind === "video" ? (
                <MediaVideo src={src(m.fileId)} active={j === cur} />
              ) : (
                // Foto dari penyimpanan privat lewat route berizin, jadi tidak lewat optimasi next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src(m.fileId)} alt={`${n.title} ${j + 1}`} draggable={false} loading={j === 0 ? undefined : "lazy"} className="pointer-events-none block size-full object-contain" />
              )}
            </div>
          ))}
        </div>
        {many && (
          <>
            <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-ink/80 px-1.5 py-[2px] text-[11px] font-bold tabular text-white">
              {cur + 1}/{items.length}
            </span>
            {cur > 0 && (
              <button type="button" data-ui="" aria-label="Sebelumnya" onPointerDown={stop} onClick={() => go(-1)} className={cx(arrow, "left-1.5")}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
            )}
            {cur < items.length - 1 && (
              <button type="button" data-ui="" aria-label="Berikutnya" onPointerDown={stop} onClick={() => go(1)} className={cx(arrow, "right-1.5")}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden="true">
              {items.slice(0, 12).map((m, j) => (
                <span key={m.fileId} className={cx("size-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)]", j === cur ? "bg-white" : "bg-white/50")} />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          aria-label={`Lihat ${n.title || "media"} penuh`}
          title="Lihat penuh (atau klik dua kali kartu)"
          data-ui=""
          onPointerDown={stop}
          onClick={onOpen}
          className={cx("absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg bg-ink/80 text-white transition-opacity duration-150 hover:bg-ink", reveal)}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-w-0 shrink-0 flex-col justify-center gap-0.5 px-3" style={{ height: MEDIA_FOOTER }}>
        <div className="truncate text-[13px] font-bold leading-[1.4]">{n.title || "Tanpa judul"}</div>
        <div className="truncate text-[11px] font-semibold text-muted">Dari {sourceName(n.url ?? "")}</div>
      </div>
    </div>
  );
}

/** Video di kartu: tombol putar sendiri, karena kontrol bawaan bentrok dengan geser kartu di kanvas. */
function MediaVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  return (
    <>
      {/* #t=0.1 supaya Safari menampilkan frame pertama sebelum diputar. */}
      <video
        ref={ref}
        src={`${src}#t=0.1`}
        preload="metadata"
        playsInline
        loop
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="pointer-events-none block size-full object-contain"
      />
      <button
        type="button"
        data-ui=""
        aria-label={playing ? "Jeda video" : "Putar video"}
        onPointerDown={stop}
        onClick={() => (playing ? ref.current?.pause() : void ref.current?.play().catch(() => {}))}
        className={cx(
          "absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink/75 text-white transition-opacity duration-150 hover:bg-ink",
          playing && "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100",
        )}
      >
        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} className="ml-0.5" aria-hidden="true" />}
      </button>
      {playing && (
        <button
          type="button"
          aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
          onPointerDown={stop}
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-lg bg-ink/75 text-white hover:bg-ink"
        >
          {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        </button>
      )}
    </>
  );
}

export function NoteCard({ n }: { n: MoodNode }) {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-hidden p-3.5">
      <div className="text-[12px] font-bold text-note-fg">{n.title || "Tanpa judul"}</div>
      <div className="overflow-hidden whitespace-pre-line text-[13px] leading-[1.5]">{n.text}</div>
    </div>
  );
}

/** Gaya teks bebas. Dipakai juga oleh textarea saat mengedit, supaya posisi huruf tidak bergeser. */
export function textStyle(n: MoodNode) {
  return {
    fontFamily: fontCss(n.font),
    fontSize: n.fontSize ?? 24,
    fontWeight: n.weight ?? 400,
    textAlign: n.align ?? "left",
    color: n.color ?? "#1c1b29",
    lineHeight: 1.3,
  } as const;
}

export function TextBody({ n }: { n: MoodNode }) {
  return (
    <div className="whitespace-pre-wrap break-words" style={textStyle(n)}>
      {n.text || " "}
    </div>
  );
}

/**
 * Bentuk dan goresan pena. Kotak dan lingkaran digambar di ukuran piksel elemen; garis dan pena
 * memakai titik di kotak vw x vh yang ditarik ke ukuran elemen, jadi resize tidak mengubah datanya.
 * `onHitDown` dipasang pada garis tebal transparan supaya goresan tipis tetap mudah dipilih.
 */
export function StrokeBody({ n, w, h, onHitDown, faded }: { n: MoodNode; w: number; h: number; onHitDown?: (e: ReactPointerEvent) => void; faded?: boolean }) {
  const sw = n.strokeWidth ?? 3;
  const color = n.color ?? "#1c1b29";
  const hitW = Math.max(16, sw + 12);
  const hitProps = onHitDown ? { onPointerDown: onHitDown, className: "pointer-events-[stroke] cursor-move" } : {};
  let shape: React.ReactNode = null;
  let hitPath: React.ReactNode = null;

  if (n.type === "draw") {
    const d = smoothPath(n.points ?? []);
    return (
      <svg
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        width={w}
        height={h}
        viewBox={`0 0 ${n.vw ?? w} ${n.vh ?? h}`}
        preserveAspectRatio="none"
        style={{ opacity: faded ? 0.3 : 1 }}
        aria-hidden="true"
      >
        {onHitDown && <path d={d} fill="none" stroke="transparent" strokeWidth={hitW} vectorEffect="non-scaling-stroke" strokeLinecap="round" {...hitProps} />}
        <path d={d} fill="none" stroke={color} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (n.shape === "line" || n.shape === "arrow") {
    const p = n.points ?? [0, 0, w, h];
    const sx = w / (n.vw ?? w);
    const sy = h / (n.vh ?? h);
    const x1 = p[0] * sx;
    const y1 = p[1] * sy;
    const x2 = p[2] * sx;
    const y2 = p[3] * sy;
    const d = `M${x1} ${y1}L${x2} ${y2}`;
    hitPath = onHitDown && <path d={d} fill="none" stroke="transparent" strokeWidth={hitW} strokeLinecap="round" {...hitProps} />;
    let head: React.ReactNode = null;
    if (n.shape === "arrow") {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const s = Math.max(10, sw * 3.5);
      const pt = (r: number) => `${x2 - s * Math.cos(a + r)},${y2 - s * Math.sin(a + r)}`;
      head = <polygon points={`${x2},${y2} ${pt(0.45)} ${pt(-0.45)}`} fill={color} stroke={color} strokeWidth={sw} strokeLinejoin="round" />;
    }
    shape = (
      <>
        <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {head}
      </>
    );
  } else {
    const fill = n.fill ?? "none";
    shape =
      n.shape === "ellipse" ? (
        <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, (w - sw) / 2)} ry={Math.max(0, (h - sw) / 2)} fill={fill} stroke={color} strokeWidth={sw} />
      ) : (
        <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={Math.min(14, w / 4, h / 4)} fill={fill} stroke={color} strokeWidth={sw} />
      );
  }

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={w} height={h} style={{ opacity: faded ? 0.3 : 1 }} aria-hidden="true">
      {hitPath}
      {shape}
    </svg>
  );
}

/* ---------- Sambungan ---------- */

export function EdgeLabel({ e, at, selected, onPointerDown }: { e: MoodEdge; at: { mx: number; my: number }; selected?: boolean; onPointerDown?: (ev: ReactPointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={cx(
        "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-surface px-2 py-[3px] text-[12px] font-semibold",
        onPointerDown && "cursor-pointer",
        selected ? "border-ink" : "border-line",
      )}
      style={{ left: at.mx, top: at.my }}
    >
      {e.label}
    </div>
  );
}

/* ---------- Foto penuh ---------- */

/** Dialog foto penuh, dengan pindah ke foto sebelumnya dan berikutnya di papan yang sama. */
export function PhotoViewer({
  photos,
  openId,
  onChange,
  src,
  mediaSrc,
}: {
  photos: MoodNode[];
  openId: string | null;
  onChange: (id: string | null) => void;
  src: (n: MoodNode) => string | null;
  mediaSrc: (fileId: string) => string;
}) {
  const i = photos.findIndex((p) => p.id === openId);
  const n = i >= 0 ? photos[i] : null;
  const go = (d: number) => {
    if (photos.length < 2) return;
    onChange(photos[(i + d + photos.length) % photos.length].id);
  };
  const url = n ? src(n) : null;
  return (
    <Modal open={!!n} onClose={() => onChange(null)} title={n?.title || "Foto referensi"} wide>
      {n && (
        <div
          className="flex flex-col gap-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "ArrowRight") go(1);
          }}
        >
          {n.type === "media" ? (
            <MediaList n={n} src={mediaSrc} />
          ) : (
            <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-ground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url && <img src={url} alt={n.title} className="block max-h-[68dvh] w-auto max-w-full object-contain" />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {n.tags.map((t) => (
              <span key={t} className="rounded-md bg-ground px-2 py-[3px] text-[11px] font-bold">
                {t}
              </span>
            ))}
            <div className="flex-1" />
            {n.type === "media" && n.url && (
              <a href={n.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold no-underline hover:bg-ground">
                <ExternalLink size={16} aria-hidden="true" />
                Buka di {sourceName(n.url)}
              </a>
            )}
            {n.fileId && url && !url.startsWith("blob:") && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold no-underline hover:bg-ground">
                <ExternalLink size={16} aria-hidden="true" />
                Buka ukuran asli
              </a>
            )}
            {photos.length > 1 && (
              <>
                <span className="text-[12px] font-semibold text-muted">
                  {i + 1} dari {photos.length}
                </span>
                <button type="button" aria-label="Foto sebelumnya" onClick={() => go(-1)} className="flex size-11 items-center justify-center rounded-xl bg-ground hover:bg-[#e8e7ef]">
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="Foto berikutnya" onClick={() => go(1)} className="flex size-11 items-center justify-center rounded-xl bg-ground hover:bg-[#e8e7ef]">
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Isi kartu media di dialog: geser ke samping untuk foto dan video berikutnya, video dengan kontrol bawaan. */
function MediaList({ n, src }: { n: MoodNode; src: (fileId: string) => string }) {
  const items: MoodMedia[] = n.media ?? [];
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-contain rounded-2xl">
      {items.map((m, j) => (
        <div key={m.fileId} className="flex w-full shrink-0 snap-center items-center justify-center overflow-hidden rounded-2xl bg-ground">
          {m.kind === "video" ? (
            <video src={src(m.fileId)} controls playsInline preload="metadata" className="block max-h-[68dvh] w-auto max-w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(m.fileId)} alt={`${n.title} ${j + 1}`} className="block max-h-[68dvh] w-auto max-w-full object-contain" />
          )}
        </div>
      ))}
    </div>
  );
}

/** Kotak pembatas seluruh isi papan, untuk tombol Paskan. */
export function contentBounds(d: MoodData, box: (n: MoodNode) => MoodRect): MoodRect | null {
  const boxes = [...d.nodes.map(box), ...d.groups];
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((r) => r.x));
  const y0 = Math.min(...boxes.map((r) => r.y));
  const x1 = Math.max(...boxes.map((r) => r.x + r.w));
  const y1 = Math.max(...boxes.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
