"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import type { MoodData, MoodNode } from "@/db/schema";
import { MOOD_GROUP_COLORS } from "@/lib/moodboard";
import { cx } from "@/components/kit";
import {
  boxOf,
  contentBounds,
  curve,
  EdgeLabel,
  insideRect,
  isCard,
  MediaCard,
  NoteCard,
  PaletteCard,
  PhotoCard,
  PhotoViewer,
  StrokeBody,
  TextBody,
} from "@/app/(fokus)/moodboard/board-view";
import { useNoPageZoom } from "@/app/(fokus)/moodboard/no-page-zoom";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;

/** Kanvas baca-saja untuk vendor: geser, zoom, cubit, dan buka foto. Bisa dipakai di HP. */
export function MoodboardViewer({ data: all, token }: { data: MoodData; token: string }) {
  // Layer yang disembunyikan pasangan di editor tidak ikut terlihat oleh vendor. Sambungan ke elemen itu ikut hilang.
  const data = { ...all, nodes: all.nodes.filter((n) => !n.hidden), groups: all.groups.filter((g) => !g.hidden) };
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [viewer, setViewer] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<
    { kind: "pan"; sx: number; sy: number; px: number; py: number; photo: string | null } | { kind: "pinch"; d0: number; zoom0: number; wx: number; wy: number } | null
  >(null);

  const src = (n: MoodNode) => (n.fileId ? `/m/${token}/foto/${n.fileId}` : null);
  const box = (n: MoodNode) => boxOf(n);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const mediaSrc = (fileId: string) => `/m/${token}/foto/${fileId}`;
  const photos = data.nodes.filter((n) => (n.type === "photo" && n.fileId) || n.type === "media");
  const opens = (n: MoodNode) => (n.type === "photo" && !!n.fileId) || n.type === "media";

  function fit() {
    const r = contentBounds(data, box);
    const el = ref.current?.getBoundingClientRect();
    if (!r || !el) return;
    const z = Math.max(ZOOM_MIN, Math.min(1, Math.min((el.width - 32) / r.w, (el.height - 32) / r.h)));
    setZoom(z);
    setPan({ x: el.width / 2 - (r.x + r.w / 2) * z, y: el.height / 2 - (r.y + r.h / 2) * z });
  }
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fit();
  });

  function local(clientX: number, clientY: number) {
    const r = ref.current!.getBoundingClientRect();
    return { sx: clientX - r.left, sy: clientY - r.top };
  }
  function zoomAt(z: number, sx: number, sy: number) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    setZoom(nz);
    setPan({ x: sx - ((sx - pan.x) / zoom) * nz, y: sy - ((sy - pan.y) / zoom) * nz });
  }

  useNoPageZoom(ref, (f, cx, cy) => {
    const r = ref.current!.getBoundingClientRect();
    zoomAt(f === null ? 1 : zoom * f, cx - r.left, cy - r.top);
  });

  function onDown(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    ref.current?.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      const m = local((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      drag.current = { kind: "pinch", d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom0: zoom, wx: (m.sx - pan.x) / zoom, wy: (m.sy - pan.y) / zoom };
      return;
    }
    const p = local(e.clientX, e.clientY);
    const photo = (e.target as HTMLElement).closest<HTMLElement>("[data-photo]")?.dataset.photo ?? null;
    drag.current = { kind: "pan", sx: p.sx, sy: p.sy, px: pan.x, py: pan.y, photo };
  }
  function onMove(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, d.zoom0 * (Math.hypot(p1.x - p2.x, p1.y - p2.y) / d.d0)));
      const m = local((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      setZoom(nz);
      setPan({ x: m.sx - d.wx * nz, y: m.sy - d.wy * nz });
      return;
    }
    const p = local(e.clientX, e.clientY);
    setPan({ x: d.px + p.sx - d.sx, y: d.py + p.sy - d.sy });
  }
  function onUp(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "pinch") {
      if (!pointers.current.size) drag.current = null;
      return;
    }
    drag.current = null;
    // Ketuk foto tanpa menggeser: buka foto penuh.
    if (d?.photo) {
      const p = local(e.clientX, e.clientY);
      if (Math.hypot(p.sx - d.sx, p.sy - d.sy) < 8) setViewer(d.photo);
    }
  }

  const grid = 20 * zoom;
  const empty = !data.nodes.length && !data.groups.length;

  return (
    <div className="relative min-h-0 flex-1 touch-manipulation overflow-hidden rounded-[22px] bg-surface">
      <div
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => {
          const p = local(e.clientX, e.clientY);
          if (e.ctrlKey || e.metaKey) zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 0.9), p.sx, p.sy);
          else setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
        }}
        role="img"
        aria-label={`Moodboard berisi ${data.nodes.length} elemen. Geser untuk melihat, cubit atau pakai tombol untuk zoom.`}
        className="absolute inset-0 cursor-grab touch-none select-none bg-ground active:cursor-grabbing"
        // Titik grid sama dengan editor: penanda bahwa kanvas bisa digeser dan di-zoom.
        style={{ backgroundImage: "radial-gradient(#cfced9 1px, transparent 1.3px)", backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
      >
        <div className="absolute left-0 top-0 size-px origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {data.groups.map((g) => {
            const c = MOOD_GROUP_COLORS[g.color] ?? MOOD_GROUP_COLORS.netral;
            return (
              <div key={g.id} className="absolute box-border rounded-[20px]" style={{ left: g.x, top: g.y, width: g.w, height: g.h, background: c.bg, border: `1.5px solid ${c.line}` }}>
                <div className="absolute inset-x-4 top-3 flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[14px] font-extrabold">{g.title || "Kelompok"}</span>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-muted">{data.nodes.filter((n) => insideRect(box(n), g)).length} elemen</span>
                </div>
              </div>
            );
          })}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
            {data.edges.map((ed) => {
              const A = byId.get(ed.from);
              const B = byId.get(ed.to);
              if (!A || !B) return null;
              return <path key={ed.id} d={curve(box(A), box(B)).d} fill="none" stroke="#6b6a7d" strokeWidth={1.75} strokeLinecap="round" />;
            })}
          </svg>
          {data.edges.map((ed) => {
            const A = byId.get(ed.from);
            const B = byId.get(ed.to);
            if (!A || !B || !ed.label) return null;
            return <EdgeLabel key={ed.id} e={ed} at={curve(box(A), box(B))} />;
          })}
          {data.nodes.map((n) => {
            const r = box(n);
            const card = isCard(n);
            return (
              <div
                key={n.id}
                data-photo={opens(n) ? n.id : undefined}
                className={cx(
                  "group/node absolute box-border",
                  card && "rounded-[18px] border-2",
                  card && (n.type === "note" ? "border-[#ebddba] bg-note-bg" : "border-line bg-surface"),
                  opens(n) && "cursor-zoom-in",
                )}
                style={{ left: n.x, top: n.y, width: r.w, height: n.type === "text" ? undefined : r.h }}
              >
                {n.type === "photo" && <PhotoCard n={n} src={src(n)} showOpen={false} onOpen={() => setViewer(n.id)} />}
                {n.type === "media" && <MediaCard n={n} src={mediaSrc} swipe showOpen={false} onOpen={() => setViewer(n.id)} />}
                {n.type === "note" && <NoteCard n={n} />}
                {n.type === "palette" && <PaletteCard n={n} />}
                {n.type === "text" && <TextBody n={n} />}
                {(n.type === "shape" || n.type === "draw") && <StrokeBody n={n} w={r.w} h={r.h} />}
              </div>
            );
          })}
        </div>
      </div>

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-[320px] rounded-[18px] bg-surface px-5 py-4 text-center text-[14px] font-semibold text-muted">Papan ini masih kosong. Pasangan belum menaruh referensi di sini.</p>
        </div>
      )}

      <div role="group" aria-label="Zoom" className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-bar">
        <button type="button" aria-label="Perkecil" onClick={() => zoomAt(zoom / 1.25, (ref.current?.clientWidth ?? 0) / 2, (ref.current?.clientHeight ?? 0) / 2)} className="flex size-11 items-center justify-center rounded-[10px] hover:bg-ground">
          <Minus size={18} aria-hidden="true" />
        </button>
        <span className="min-w-11 text-center text-[12px] font-bold tabular">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Perbesar" onClick={() => zoomAt(zoom * 1.25, (ref.current?.clientWidth ?? 0) / 2, (ref.current?.clientHeight ?? 0) / 2)} className="flex size-11 items-center justify-center rounded-[10px] hover:bg-ground">
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={fit} className="h-11 rounded-[10px] bg-ground px-3 text-[13px] font-bold">
          Paskan
        </button>
      </div>

      <PhotoViewer photos={photos} openId={viewer} onChange={setViewer} src={src} mediaSrc={mediaSrc} />
    </div>
  );
}
