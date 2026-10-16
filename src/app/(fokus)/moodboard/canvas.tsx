"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, Maximize2, MousePointer2, Minus, NotebookPen, Palette, Plus, Spline, SquareDashed, Upload } from "lucide-react";
import type { MoodData, MoodEdge, MoodGroup, MoodNode } from "@/db/schema";
import { saveMoodboard } from "@/actions/moodboard";
import { MOOD_BOARDS, MOOD_GROUP_COLORS, MOOD_LIMITS, MOOD_TAGS, MOOD_TAG_MAX, type MoodBoardId } from "@/lib/moodboard";
import { cx, Input, Textarea } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { Modal } from "@/components/forms";
import { ColorField } from "@/components/color-field";
import { BrandingCard } from "@/components/ui/color-palette";

type LocalNode = MoodNode & { uploading?: boolean; preview?: string };
type LocalData = { nodes: LocalNode[]; edges: MoodEdge[]; groups: MoodGroup[] };
type Sel = { kind: "node" | "edge" | "group"; id: string } | null;
type Drag =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "node"; id: string; dx: number; dy: number }
  | { kind: "link"; from: string }
  | { kind: "group"; id: string; x0: number; y0: number; ox: number; oy: number; kids: Record<string, { x: number; y: number }> }
  | { kind: "resize"; id: string; x0: number; y0: number; w0: number; h0: number }
  | { kind: "pinch"; d0: number; zoom0: number; wx: number; wy: number };
type SaveState = "saved" | "saving" | "dirty" | "error" | "conflict";

const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO = 10 * 1024 * 1024;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const PAN0 = { x: 96, y: 24 };
// Lebar toolbar alat di kiri kanvas: area kerja dihitung dari sini supaya kartu tidak tertutup.
const LEFT = 84;

function size(n: { type: string }) {
  // Tinggi dihitung dari isi (border, padding, judul, isi) supaya judul tidak terpotong.
  if (n.type === "photo") return { w: 240, h: 222 };
  if (n.type === "note") return { w: 220, h: 132 };
  if (n.type === "palette") return { w: 260, h: 236 };
  return { w: 0, h: 0 };
}

function inside(n: MoodNode, g: MoodGroup) {
  const s = size(n);
  const cx = n.x + s.w / 2;
  const cy = n.y + s.h / 2;
  return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h;
}

/** Kurva bezier dari sisi kartu A ke sisi kartu B (atau ke titik kursor). */
function curve(a: MoodNode, b: { x: number; y: number; type: string }) {
  const sa = size(a);
  const sb = size(b);
  const ax = a.x + sa.w / 2;
  const ay = a.y + sa.h / 2;
  const bx = b.x + sb.w / 2;
  const by = b.y + sb.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  let p0, p3, c1, c2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = dx >= 0 ? 1 : -1;
    p0 = { x: ax + (s * sa.w) / 2, y: ay };
    p3 = { x: bx - (s * sb.w) / 2, y: by };
    const o = Math.max(40, Math.abs(p3.x - p0.x) / 2);
    c1 = { x: p0.x + s * o, y: p0.y };
    c2 = { x: p3.x - s * o, y: p3.y };
  } else {
    const s = dy >= 0 ? 1 : -1;
    p0 = { x: ax, y: ay + (s * sa.h) / 2 };
    p3 = { x: bx, y: by - (s * sb.h) / 2 };
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

/** Isi papan yang dikirim ke server: tanpa kartu yang masih diunggah dan tanpa pratinjau lokal. */
function toSaved(d: LocalData): MoodData {
  const nodes: MoodNode[] = d.nodes
    .filter((n) => !n.uploading)
    .map((n) => {
      const out: LocalNode = { ...n };
      delete out.uploading;
      delete out.preview;
      return out;
    });
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: d.edges.filter((e) => ids.has(e.from) && ids.has(e.to)), groups: d.groups };
}

const uid = () => crypto.randomUUID();

export function MoodboardCanvas({
  initial,
  initialRev,
}: {
  initial: Record<MoodBoardId, MoodData>;
  initialRev: Record<MoodBoardId, number>;
}) {
  const [boards, setBoards] = useState<Record<string, LocalData>>(initial);
  const [active, setActive] = useState<MoodBoardId>("utama");
  const [tool, setTool] = useState<"select" | "link">("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(PAN0);
  const [sel, setSel] = useState<Sel>(null);
  const [linkCursor, setLinkCursor] = useState<{ from: string; x: number; y: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [save, setSave] = useState<Record<string, SaveState>>({ utama: "saved", akad: "saved", resepsi: "saved" });
  const [linkTarget, setLinkTarget] = useState("");
  const [newTag, setNewTag] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Ketukan terakhir pada kartu, untuk mendeteksi klik dua kali (dblclick bawaan hilang karena pointer ditangkap kanvas).
  const lastTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const boardsRef = useRef(boards);
  const revs = useRef<Record<string, number>>({ ...initialRev });
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  // Peringatkan sebelum menutup tab bila masih ada perubahan yang belum tersimpan.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || flushing.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const b = boards[active];
  // Tag bawaan sebagai saran, ditambah tag buatan anggota yang dipakai di papan mana pun.
  // Warna dari semua palet di papan aktif, jadi pilihan cepat di color picker.
  const boardColors = b.nodes.flatMap((n) => n.swatches ?? []);
  const allTags = [...new Set([...MOOD_TAGS, ...Object.values(boards).flatMap((d) => d.nodes.flatMap((n) => n.tags))])];
  const byId = new Map(b.nodes.map((n) => [n.id, n]));

  /* ---------- Simpan otomatis ---------- */

  async function flush() {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const id of [...dirty.current]) {
        dirty.current.delete(id);
        setSave((s) => ({ ...s, [id]: "saving" }));
        const r = await saveMoodboard(id, revs.current[id] ?? 0, toSaved(boardsRef.current[id]));
        if (r.ok) {
          revs.current[id] = r.rev ?? revs.current[id];
          setSave((s) => ({ ...s, [id]: dirty.current.has(id) ? "dirty" : "saved" }));
        } else {
          if (!r.conflict) dirty.current.add(id);
          setSave((s) => ({ ...s, [id]: r.conflict ? "conflict" : "error" }));
          flash(r.error);
          return;
        }
      }
    } finally {
      flushing.current = false;
    }
    if (dirty.current.size) schedule();
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }

  function update(fn: (d: LocalData) => LocalData, boardId: string = active) {
    if (save[boardId] === "conflict") return;
    setBoards((prev) => ({ ...prev, [boardId]: fn(prev[boardId]) }));
    dirty.current.add(boardId);
    setSave((s) => ({ ...s, [boardId]: "dirty" }));
    schedule();
  }

  function flash(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  /* ---------- Operasi papan ---------- */

  const updNode = (id: string, patch: Partial<LocalNode>, boardId?: string) =>
    update((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }), boardId);
  const updEdge = (id: string, patch: Partial<MoodEdge>) =>
    update((d) => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const updGroup = (id: string, patch: Partial<MoodGroup>) =>
    update((d) => ({ ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const removeNode = (id: string, boardId?: string) => {
    update((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) }), boardId);
    setSel(null);
  };
  const removeEdge = (id: string) => {
    update((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    setSel(null);
  };
  const removeGroup = (id: string) => {
    update((d) => ({ ...d, groups: d.groups.filter((g) => g.id !== id) }));
    setSel(null);
  };
  const toFront = (id: string) =>
    setBoards((prev) => {
      const d = prev[active];
      const n = d.nodes.find((x) => x.id === id);
      if (!n || d.nodes.at(-1)?.id === id) return prev;
      return { ...prev, [active]: { ...d, nodes: [...d.nodes.filter((x) => x.id !== id), n] } };
    });
  function connect(from: string, to: string) {
    if (from === to) return;
    if (b.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) {
      flash("Kedua kartu sudah tersambung.");
      return;
    }
    const id = uid();
    update((d) => ({ ...d, edges: [...d.edges, { id, from, to, label: "" }] }));
    setSel({ kind: "edge", id });
  }

  function viewSize() {
    const r = boardRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 800, h: r?.height ?? 600 };
  }
  /** Titik tengah area kerja (di kanan toolbar) dalam koordinat papan. */
  function center(w = 240, h = 200) {
    const v = viewSize();
    return { x: Math.round((LEFT + (v.w - LEFT) / 2 - pan.x) / zoom - w / 2), y: Math.round((v.h / 2 - pan.y) / zoom - h / 2) };
  }
  /** Tempat kosong terdekat dari tengah layar, supaya kartu baru tidak menumpuk di atas kartu lain. */
  function freeSpot(w: number, h: number) {
    const c = center(w, h);
    const hits = (x: number, y: number) =>
      b.nodes.some((n) => {
        const s = size(n);
        return x < n.x + s.w + 16 && x + w + 16 > n.x && y < n.y + s.h + 16 && y + h + 16 > n.y;
      });
    for (let r = 0; r <= 4; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.x + dx * (w + 24);
          const y = c.y + dy * (h + 24);
          if (!hits(x, y)) return { x, y };
        }
    return c;
  }
  function addNode(n: Omit<LocalNode, "id" | "x" | "y" | "tags">, at?: { x: number; y: number }) {
    if (b.nodes.length >= MOOD_LIMITS.nodes) {
      flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} kartu.`);
      return null;
    }
    const id = uid();
    const pos = at ?? freeSpot(size(n).w, size(n).h);
    update((d) => ({ ...d, nodes: [...d.nodes, { id, tags: [], ...pos, ...n }] }));
    setSel({ kind: "node", id });
    setTool("select");
    return id;
  }
  function addGroup(title = "Kelompok baru", at?: { x: number; y: number; w: number; h: number }, color = "netral") {
    const id = uid();
    const c = center(560, 320);
    update((d) => ({ ...d, groups: [...d.groups, { id, title, color, x: c.x, y: c.y, w: 560, h: 320, ...at }] }));
    return id;
  }
  function starterGroups() {
    const g = (title: string, color: string, x: number, y: number, w: number, h: number): MoodGroup => ({ id: uid(), title, color, x, y, w, h });
    const groups = [
      g("Dekor dan pelaminan", "netral", 0, 0, 880, 320),
      g("Busana", "lavender", 0, 350, 560, 300),
      g("Warna dan bunga", "krem", 590, 350, 290, 300),
    ];
    update((d) => ({ ...d, groups: [...d.groups, ...groups] }));
    setSel({ kind: "group", id: groups[0].id });
    fit({ ...b, groups: [...b.groups, ...groups] });
  }

  /* ---------- Foto ---------- */

  async function uploadPhoto(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("kind", "moodboard");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Unggah gagal.");
    return data.id as string;
  }

  function checkPhoto(f: File) {
    if (!PHOTO_MIME.includes(f.type)) return "Hanya foto JPG, PNG, atau WEBP yang bisa ditaruh di moodboard.";
    if (f.size > MAX_PHOTO) return `${f.name} lebih dari 10 MB.`;
    return null;
  }

  function addPhotos(files: FileList | File[] | null, at?: { x: number; y: number }) {
    const list = Array.from(files ?? []);
    const boardId = active;
    const base = at ?? freeSpot(240, 214);
    let i = 0;
    for (const f of list) {
      const err = checkPhoto(f);
      if (err) {
        flash(err);
        continue;
      }
      const pos = { x: base.x + i * 28, y: base.y + i * 28 };
      i++;
      const id = addNode({ type: "photo", title: f.name.replace(/\.[^.]+$/, "").slice(0, 120), uploading: true, preview: URL.createObjectURL(f) }, pos);
      if (!id) break;
      uploadPhoto(f)
        .then((fileId) => updNode(id, { fileId, uploading: false }, boardId))
        .catch((e: Error) => {
          removeNode(id, boardId);
          flash(`${f.name} belum terunggah. ${e.message}`);
        });
    }
  }

  function replacePhoto(id: string, f: File | undefined) {
    if (!f) return;
    const err = checkPhoto(f);
    if (err) return flash(err);
    const boardId = active;
    const old = byId.get(id);
    updNode(id, { uploading: true, preview: URL.createObjectURL(f) });
    uploadPhoto(f)
      .then((fileId) => updNode(id, { fileId, uploading: false }, boardId))
      .catch((e: Error) => {
        updNode(id, { uploading: false, preview: undefined, fileId: old?.fileId }, boardId);
        flash(`Foto belum terganti. ${e.message}`);
      });
  }

  /* ---------- Kanvas: pointer, zoom, keyboard ---------- */

  function world(clientX: number, clientY: number) {
    const r = boardRef.current!.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    return { sx, sy, x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  }

  function zoomAt(z: number, sx: number, sy: number) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    const wx = (sx - pan.x) / zoom;
    const wy = (sy - pan.y) / zoom;
    setZoom(nz);
    setPan({ x: sx - wx * nz, y: sy - wy * nz });
  }
  const zoomStep = (d: number) => {
    const v = viewSize();
    zoomAt(Math.round((zoom + d) * 10) / 10, v.w / 2, v.h / 2);
  };
  function fit(d = b) {
    const v = viewSize();
    const boxes = [...d.nodes.map((n) => ({ x: n.x, y: n.y, ...size(n) })), ...d.groups];
    if (!boxes.length) {
      setZoom(1);
      setPan(PAN0);
      return;
    }
    const x0 = Math.min(...boxes.map((r) => r.x));
    const y0 = Math.min(...boxes.map((r) => r.y));
    const x1 = Math.max(...boxes.map((r) => r.x + r.w));
    const y1 = Math.max(...boxes.map((r) => r.y + r.h));
    const z = Math.max(ZOOM_MIN, Math.min(1.2, Math.min((v.w - LEFT - 48) / (x1 - x0), (v.h - 64) / (y1 - y0))));
    setZoom(z);
    setPan({ x: LEFT + (v.w - LEFT) / 2 - ((x0 + x1) / 2) * z, y: v.h / 2 - ((y0 + y1) / 2) * z });
  }
  /** Geser tampilan supaya kartu terlihat (dipakai dari daftar kartu dan keyboard). */
  function reveal(n: MoodNode) {
    const v = viewSize();
    const s = size(n);
    setPan({ x: LEFT + (v.w - LEFT) / 2 - (n.x + s.w / 2) * zoom, y: v.h / 2 - (n.y + s.h / 2) * zoom });
  }

  function pickBoard(id: MoodBoardId) {
    setActive(id);
    setSel(null);
    setTool("select");
    drag.current = null;
    fit(boards[id]);
  }

  function startDrag(e: ReactPointerEvent, d: Drag) {
    drag.current = d;
    boardRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerDownCapture(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Dua jari di tablet: cubit untuk zoom, apa pun yang sedang digeser dibatalkan.
      const [p1, p2] = [...pointers.current.values()];
      const mid = world((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      drag.current = { kind: "pinch", d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom0: zoom, wx: mid.x, wy: mid.y };
      setLinkCursor(null);
      boardRef.current?.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }
  }

  function onBoardDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    boardRef.current?.focus({ preventScroll: true });
    const p = world(e.clientX, e.clientY);
    setSel(null);
    startDrag(e, { kind: "pan", sx: p.sx, sy: p.sy, px: pan.x, py: pan.y });
  }

  function onNodeDown(e: ReactPointerEvent, n: LocalNode, viaHandle = false) {
    if (e.button !== 0 || drag.current?.kind === "pinch") return;
    e.stopPropagation();
    const prev = lastTap.current;
    const now = e.timeStamp;
    lastTap.current = { id: n.id, t: now, x: e.clientX, y: e.clientY };
    if (!viaHandle && n.type === "photo" && prev?.id === n.id && now - prev.t < 400 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 8) {
      lastTap.current = null;
      setSel({ kind: "node", id: n.id });
      setViewer(n.id);
      return;
    }
    boardRef.current?.focus({ preventScroll: true });
    toFront(n.id);
    setSel({ kind: "node", id: n.id });
    const p = world(e.clientX, e.clientY);
    if (viaHandle || tool === "link") {
      startDrag(e, { kind: "link", from: n.id });
      setLinkCursor({ from: n.id, x: p.x, y: p.y });
    } else startDrag(e, { kind: "node", id: n.id, dx: p.x - n.x, dy: p.y - n.y });
  }

  function onGroupDown(e: ReactPointerEvent, g: MoodGroup) {
    if (e.button !== 0 || drag.current?.kind === "pinch") return;
    e.stopPropagation();
    boardRef.current?.focus({ preventScroll: true });
    setSel({ kind: "group", id: g.id });
    const p = world(e.clientX, e.clientY);
    const kids: Record<string, { x: number; y: number }> = {};
    for (const n of b.nodes) if (inside(n, g)) kids[n.id] = { x: n.x, y: n.y };
    startDrag(e, { kind: "group", id: g.id, x0: p.x, y0: p.y, ox: g.x, oy: g.y, kids });
  }

  function onResizeDown(e: ReactPointerEvent, g: MoodGroup) {
    e.stopPropagation();
    const p = world(e.clientX, e.clientY);
    startDrag(e, { kind: "resize", id: g.id, x0: p.x, y0: p.y, w0: g.w, h0: g.h });
  }

  function onMove(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, d.zoom0 * (Math.hypot(p1.x - p2.x, p1.y - p2.y) / d.d0)));
      const r = boardRef.current!.getBoundingClientRect();
      const mx = (p1.x + p2.x) / 2 - r.left;
      const my = (p1.y + p2.y) / 2 - r.top;
      setZoom(nz);
      setPan({ x: mx - d.wx * nz, y: my - d.wy * nz });
      return;
    }
    const p = world(e.clientX, e.clientY);
    if (d.kind === "pan") setPan({ x: d.px + (p.sx - d.sx), y: d.py + (p.sy - d.sy) });
    else if (d.kind === "node") updNode(d.id, { x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) });
    else if (d.kind === "link") setLinkCursor({ from: d.from, x: p.x, y: p.y });
    else if (d.kind === "group") {
      const dx = p.x - d.x0;
      const dy = p.y - d.y0;
      update((bd) => ({
        ...bd,
        groups: bd.groups.map((g) => (g.id === d.id ? { ...g, x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) } : g)),
        nodes: bd.nodes.map((n) => (d.kids[n.id] ? { ...n, x: Math.round(d.kids[n.id].x + dx), y: Math.round(d.kids[n.id].y + dy) } : n)),
      }));
    } else if (d.kind === "resize")
      updGroup(d.id, { w: Math.max(240, Math.round(d.w0 + p.x - d.x0)), h: Math.max(140, Math.round(d.h0 + p.y - d.y0)) });
  }

  function onUp(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "pinch") {
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    if (d?.kind === "link") {
      const p = world(e.clientX, e.clientY);
      const hit = [...b.nodes].reverse().find((n) => {
        const s = size(n);
        return p.x >= n.x - 10 && p.x <= n.x + s.w + 10 && p.y >= n.y - 10 && p.y <= n.y + s.h + 10;
      });
      if (hit && hit.id !== d.from) connect(d.from, hit.id);
    }
    drag.current = null;
    setLinkCursor(null);
  }

  function onWheel(e: WheelEvent) {
    const p = world(e.clientX, e.clientY);
    if (e.ctrlKey || e.metaKey) zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 0.9), p.sx, p.sy);
    else setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key;
    const step = e.shiftKey ? 1 : 10;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if ((k === "Delete" || k === "Backspace") && sel) {
      e.preventDefault();
      if (sel.kind === "node") removeNode(sel.id);
      else if (sel.kind === "edge") removeEdge(sel.id);
      else removeGroup(sel.id);
    } else if (k === "Escape") {
      setSel(null);
      setTool("select");
      drag.current = null;
      setLinkCursor(null);
    } else if (arrows[k] && sel && sel.kind !== "edge") {
      e.preventDefault();
      const [dx, dy] = arrows[k];
      if (sel.kind === "node") {
        const n = byId.get(sel.id);
        if (n) updNode(n.id, { x: n.x + dx, y: n.y + dy });
      } else {
        const g = b.groups.find((x) => x.id === sel.id);
        if (g)
          update((bd) => ({
            ...bd,
            groups: bd.groups.map((x) => (x.id === g.id ? { ...x, x: x.x + dx, y: x.y + dy } : x)),
            nodes: bd.nodes.map((n) => (inside(n, g) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
          }));
      }
    } else if (k === "v" || k === "V") setTool("select");
    else if (k === "c" || k === "C") setTool("link");
    else if (k === "+" || k === "=") zoomStep(0.1);
    else if (k === "-") zoomStep(-0.1);
  }

  // Saat halaman dibuka, paskan tampilan ke isi papan supaya tidak ada kartu yang terpotong di layar sempit.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fit();
  });

  /* ---------- Turunan untuk render ---------- */

  const selNode = sel?.kind === "node" ? byId.get(sel.id) : undefined;
  const selEdge = sel?.kind === "edge" ? b.edges.find((x) => x.id === sel.id) : undefined;
  const selGroup = sel?.kind === "group" ? b.groups.find((x) => x.id === sel.id) : undefined;
  const linkFrom = linkCursor ? byId.get(linkCursor.from) : undefined;
  const linkD = linkFrom && linkCursor ? curve(linkFrom, { type: "point", x: linkCursor.x, y: linkCursor.y }).d : "";
  const isEmpty = b.nodes.length === 0 && b.groups.length === 0;
  const state = save[active];
  const locked = state === "conflict";
  const grid = 20 * zoom;
  const boardName = MOOD_BOARDS.find((x) => x.id === active)!.name;

  const SAVE_TEXT: Record<SaveState, string> = {
    saved: "Tersimpan",
    saving: "Menyimpan…",
    dirty: "Belum tersimpan",
    error: "Gagal menyimpan",
    conflict: "Diubah anggota lain",
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-surface">
      {/* Bar atas */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <Link
          href="/dashboard"
          className="-ml-1 inline-flex h-11 items-center gap-1.5 rounded-xl pl-2 pr-3 text-[13px] font-bold text-muted no-underline hover:bg-ground hover:text-ink"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Dashboard
        </Link>
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">Moodboard</h1>
        <div role="group" aria-label="Papan" className="flex gap-1 rounded-xl bg-ground p-1">
          {MOOD_BOARDS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={active === x.id}
              onClick={() => pickBoard(x.id)}
              className={cx(
                "flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold transition-colors duration-150",
                active === x.id ? "bg-ink text-white" : "text-ink hover:bg-surface",
              )}
            >
              {x.name}
              <span className="hidden text-[11px] font-medium opacity-80 min-[1440px]:inline">{boards[x.id].nodes.length} kartu</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <p role="status" className={cx("text-[12px] font-semibold", state === "error" || state === "conflict" ? "text-warn-fg" : "text-muted")}>
          {SAVE_TEXT[state]}
        </p>
        {state === "error" && (
          <button type="button" onClick={flush} className="hit-44 h-9 rounded-lg px-2 text-[12px] font-bold underline underline-offset-2">
            Coba lagi
          </button>
        )}
        {state === "conflict" && (
          <button type="button" onClick={() => window.location.reload()} className="hit-44 h-9 rounded-lg px-2 text-[12px] font-bold underline underline-offset-2">
            Muat ulang
          </button>
        )}
        <div role="group" aria-label="Zoom" className="flex items-center gap-0.5 rounded-xl bg-ground p-1">
          <button type="button" aria-label="Perkecil" onClick={() => zoomStep(-0.1)} className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface">
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className="min-w-11 text-center text-[12px] font-bold tabular">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Perbesar" onClick={() => zoomStep(0.1)} className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface">
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => fit()} className="h-10 rounded-[10px] bg-surface px-3 text-[12px] font-bold">
            Paskan
          </button>
        </div>
        <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-bold text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-[#2e2d40]">
          <Upload size={16} aria-hidden="true" />
          Unggah foto
          <input
            type="file"
            accept={PHOTO_MIME.join(",")}
            multiple
            disabled={locked}
            className="sr-only"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Kanvas */}
        <div
          ref={boardRef}
          tabIndex={0}
          role="application"
          aria-roledescription="kanvas"
          aria-label={`Kanvas moodboard ${boardName}`}
          aria-describedby="mb-help"
          onPointerDownCapture={onPointerDownCapture}
          onPointerDown={onBoardDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
          onKeyDown={onKey}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (locked) return;
            const p = world(e.clientX, e.clientY);
            addPhotos(e.dataTransfer.files, { x: Math.round(p.x - 120), y: Math.round(p.y - 100) });
          }}
          className={cx(
            "relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-ground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
            tool === "link" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
          )}
          // Titik grid ikut bergeser dan membesar bersama kanvas: penanda bahwa area ini bisa digeser dan di-zoom.
          style={{
            backgroundImage: "radial-gradient(#cfced9 1px, transparent 1.3px)",
            backgroundSize: `${grid}px ${grid}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          <div className="absolute left-0 top-0 size-px origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {b.groups.map((g) => {
              const c = MOOD_GROUP_COLORS[g.color] ?? MOOD_GROUP_COLORS.netral;
              const on = selGroup?.id === g.id;
              return (
                <div
                  key={g.id}
                  onPointerDown={(e) => onGroupDown(e, g)}
                  className="absolute box-border cursor-move rounded-[20px]"
                  style={{ left: g.x, top: g.y, width: g.w, height: g.h, background: c.bg, border: on ? "2px solid #1c1b29" : `1.5px solid ${c.line}` }}
                >
                  <div className="absolute inset-x-4 top-3 flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[14px] font-extrabold">{g.title || "Kelompok"}</span>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-muted">{b.nodes.filter((n) => inside(n, g)).length} kartu</span>
                  </div>
                  {on && (
                    <div
                      aria-hidden="true"
                      onPointerDown={(e) => onResizeDown(e, g)}
                      className="absolute -bottom-4 -right-4 flex size-8 cursor-nwse-resize items-center justify-center"
                    >
                      <span className="size-4 rounded-[4px] border-2 border-ink bg-surface" />
                    </div>
                  )}
                </div>
              );
            })}

            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
              {b.edges.map((ed) => {
                const A = byId.get(ed.from);
                const B = byId.get(ed.to);
                if (!A || !B) return null;
                const { d } = curve(A, B);
                const on = selEdge?.id === ed.id;
                return (
                  <g key={ed.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                      className="pointer-events-[stroke] cursor-pointer"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSel({ kind: "edge", id: ed.id });
                      }}
                    />
                    <path d={d} fill="none" stroke={on ? "#1c1b29" : "#6b6a7d"} strokeWidth={on ? 2.5 : 1.75} strokeLinecap="round" />
                  </g>
                );
              })}
              {linkD && <path d={linkD} fill="none" stroke="#1c1b29" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />}
            </svg>

            {b.edges.map((ed) => {
              const A = byId.get(ed.from);
              const B = byId.get(ed.to);
              if (!A || !B || !ed.label) return null;
              const { mx, my } = curve(A, B);
              return (
                <div
                  key={ed.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSel({ kind: "edge", id: ed.id });
                  }}
                  className={cx(
                    "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer whitespace-nowrap rounded-md border bg-surface px-2 py-[3px] text-[12px] font-semibold",
                    selEdge?.id === ed.id ? "border-ink" : "border-line",
                  )}
                  style={{ left: mx, top: my }}
                >
                  {ed.label}
                </div>
              );
            })}

            {b.nodes.map((n) => {
              const s = size(n);
              const on = selNode?.id === n.id;
              const showHandles = on || tool === "link";
              return (
                <div
                  key={n.id}
                  onPointerDown={(e) => onNodeDown(e, n)}
                  className={cx(
                    "group/node absolute box-border rounded-[18px] border-2",
                    tool === "link" ? "cursor-crosshair" : "cursor-move",
                    n.type === "note" ? "bg-note-bg" : "bg-surface",
                    on ? "border-ink" : n.type === "note" ? "border-[#ebddba]" : "border-line",
                  )}
                  style={{ left: n.x, top: n.y, width: s.w, height: s.h }}
                >
                  {(["right", "left", "top", "bottom"] as const).map((side) => (
                    <span
                      key={side}
                      aria-hidden="true"
                      onPointerDown={(e) => onNodeDown(e, n, true)}
                      className={cx(
                        "absolute z-[2] size-[18px] cursor-crosshair rounded-full border-2 border-ink bg-surface transition-opacity duration-150 hover:bg-ink",
                        showHandles ? "opacity-100" : "opacity-0 group-hover/node:opacity-100",
                        side === "right" && "-right-[10px] top-1/2 -mt-[9px]",
                        side === "left" && "-left-[10px] top-1/2 -mt-[9px]",
                        side === "top" && "-top-[10px] left-1/2 -ml-[9px]",
                        side === "bottom" && "-bottom-[10px] left-1/2 -ml-[9px]",
                      )}
                    />
                  ))}
                  {n.type === "photo" && <PhotoCard n={n} showOpen={on} onOpen={() => setViewer(n.id)} />}
                  {n.type === "note" && (
                    <div className="flex h-full flex-col gap-1.5 overflow-hidden p-3.5">
                      <div className="text-[12px] font-bold text-note-fg">{n.title || "Tanpa judul"}</div>
                      <div className="overflow-hidden whitespace-pre-line text-[13px] leading-[1.5]">{n.text}</div>
                    </div>
                  )}
                  {n.type === "palette" && <PaletteCard n={n} />}
                </div>
              );
            })}
          </div>

          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto flex max-w-[380px] flex-col items-start gap-2 rounded-[20px] border-[1.5px] border-dashed border-outline bg-surface px-7 py-6">
                <p className="text-[16px] font-extrabold">Papan {boardName} masih kosong</p>
                <p className="text-[13px] leading-[1.5] text-muted">
                  Seret foto referensi dari komputer ke sini, atau pakai Unggah foto. Mau mulai dari kerangka? Buat kelompok Dekor, Busana, dan Warna
                  lalu isi satu per satu.
                </p>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={starterGroups}
                  disabled={locked}
                  className="mt-1 inline-flex h-11 items-center rounded-xl bg-ground px-4 text-[13px] font-bold hover:bg-[#e8e7ef]"
                >
                  Buat kelompok awal
                </button>
              </div>
            </div>
          )}

          {/* Alat */}
          <div
            role="toolbar"
            aria-label="Alat moodboard"
            aria-orientation="vertical"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-3 top-3 flex flex-col gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-bar"
          >
            <ToolButton label="Pilih" hint="Pilih dan geser (V)" on={tool === "select"} onClick={() => setTool("select")} icon={<MousePointer2 size={18} aria-hidden="true" />} />
            <ToolButton label="Sambung" hint="Sambung kartu (C)" on={tool === "link"} onClick={() => setTool("link")} icon={<Spline size={18} aria-hidden="true" />} />
            <div className="mx-1.5 my-0.5 h-px bg-line" />
            <label
              title="Tambah foto"
              className="relative flex h-[52px] w-14 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-xl text-[11px] font-bold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-ground"
            >
              <ImageIcon size={18} aria-hidden="true" />
              Foto
              <input
                type="file"
                accept={PHOTO_MIME.join(",")}
                multiple
                disabled={locked}
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <ToolButton
              label="Catatan"
              hint="Tambah catatan"
              disabled={locked}
              onClick={() => addNode({ type: "note", title: "Catatan baru", text: "" })}
              icon={<NotebookPen size={18} aria-hidden="true" />}
            />
            <ToolButton
              label="Warna"
              hint="Tambah palet warna"
              disabled={locked}
              onClick={() => addNode({ type: "palette", title: "Palet baru", swatches: ["#f4f1ea", "#d9d8e4", "#7c8b6a"] })}
              icon={<Palette size={18} aria-hidden="true" />}
            />
            <ToolButton
              label="Kelompok"
              hint="Tambah kelompok, misalnya Pelaminan atau Busana"
              disabled={locked}
              onClick={() => {
                const id = addGroup();
                setSel({ kind: "group", id });
                setTool("select");
              }}
              icon={<SquareDashed size={18} aria-hidden="true" />}
            />
          </div>

          {(tool === "link" || linkD) && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-bar">
              {linkD ? "Lepas di atas kartu lain untuk menyambung" : "Mode sambung: tekan sebuah kartu, lalu tarik ke kartu lain"}
            </p>
          )}
          {notice && (
            <p role="alert" className="absolute right-3 top-3 max-w-[320px] rounded-xl bg-warn-bg px-3.5 py-2.5 text-[13px] font-semibold text-warn-fg">
              {notice}
            </p>
          )}
        </div>

        {/* Panel detail */}
        <aside aria-label="Detail" className="flex w-[264px] shrink-0 flex-col gap-4 overflow-y-auto *:shrink-0 border-l border-line p-4 min-[1200px]:w-[300px] min-[1200px]:p-5">
          {selNode ? (
            <>
              <PanelHead label={{ photo: "Foto referensi", note: "Catatan", palette: "Palet warna" }[selNode.type]} onDone={() => setSel(null)} />
              <Text label="Judul" value={selNode.title} max={120} onChange={(v) => updNode(selNode.id, { title: v })} />
              {selNode.type === "note" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-muted">Isi catatan</span>
                  <Textarea
                    rows={5}
                    maxLength={2000}
                    value={selNode.text ?? ""}
                    placeholder="Tulis ide atau pertanyaan, misalnya untuk MUA atau dekorator."
                    onChange={(e) => updNode(selNode.id, { text: e.target.value })}
                    className="resize-y leading-[1.5]"
                  />
                </label>
              )}
              {selNode.type === "photo" && (selNode.fileId || selNode.preview) && (
                <PhotoAdjust n={selNode} onChange={(patch) => updNode(selNode.id, patch)} onOpen={() => setViewer(selNode.id)} />
              )}
              {selNode.type === "photo" && (
                <label className="relative flex h-11 cursor-pointer items-center justify-center rounded-xl border border-outline text-[13px] font-bold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-sunken">
                  {selNode.uploading ? "Mengunggah…" : "Ganti foto"}
                  <input
                    type="file"
                    accept={PHOTO_MIME.join(",")}
                    disabled={selNode.uploading}
                    className="sr-only"
                    onChange={(e) => {
                      replacePhoto(selNode.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {selNode.type === "palette" && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-[12px] font-semibold text-muted">Warna</legend>
                  {(selNode.swatches ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <ColorField
                        label={`Warna ${i + 1}`}
                        value={c}
                        swatches={boardColors}
                        onChange={(hex) => updNode(selNode.id, { swatches: (selNode.swatches ?? []).map((x, j) => (j === i ? hex : x)) })}
                      />
                      <button
                        type="button"
                        onClick={() => updNode(selNode.id, { swatches: (selNode.swatches ?? []).filter((_, j) => j !== i) })}
                        className="h-11 shrink-0 rounded-lg px-2.5 text-[12px] font-semibold text-muted hover:bg-ground"
                        aria-label={`Hapus warna ${c}`}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  {(selNode.swatches ?? []).length < MOOD_LIMITS.swatches && (
                    <button
                      type="button"
                      onClick={() => updNode(selNode.id, { swatches: [...(selNode.swatches ?? []), "#e8e7ef"] })}
                      className="h-10 rounded-xl border-[1.5px] border-dashed border-outline text-[12px] font-bold hover:bg-sunken"
                    >
                      Tambah warna
                    </button>
                  )}
                </fieldset>
              )}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[12px] font-semibold text-muted">Tag</legend>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => {
                    const on = selNode.tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updNode(selNode.id, { tags: on ? selNode.tags.filter((x) => x !== t) : [...selNode.tags, t] })}
                        className={cx(
                          "hit-44 h-9 rounded-md border px-2.5 text-[12px] font-semibold transition-colors duration-150",
                          on ? "border-ink bg-ink text-white" : "border-line bg-surface hover:bg-sunken",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <form
                  className="mt-1 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = newTag.trim().replace(/\s+/g, " ").slice(0, MOOD_TAG_MAX);
                    if (!t) return;
                    const same = allTags.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
                    if (!selNode.tags.includes(same)) {
                      if (selNode.tags.length >= 12) return flash("Satu kartu maksimal 12 tag.");
                      updNode(selNode.id, { tags: [...selNode.tags, same] });
                    }
                    setNewTag("");
                  }}
                >
                  <Input
                    aria-label="Tag baru"
                    value={newTag}
                    maxLength={MOOD_TAG_MAX}
                    placeholder="Tag baru, misal Siraman"
                    onChange={(e) => setNewTag(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <button type="submit" disabled={!newTag.trim()} className="h-11 shrink-0 rounded-xl bg-ground px-3 text-[13px] font-bold hover:bg-[#e8e7ef] disabled:text-muted">
                    Tambah
                  </button>
                </form>
                <p className="text-[12px] text-muted">Tag buatan sendiri muncul di semua papan. Tag yang tidak dipakai kartu mana pun hilang dari daftar.</p>
              </fieldset>
              {b.nodes.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-muted">Sambungkan ke kartu lain</span>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        aria-label="Sambungkan ke kartu lain"
                        value={linkTarget}
                        onValueChange={setLinkTarget}
                        options={[
                          { value: "", label: "Pilih kartu" },
                          ...b.nodes.filter((n) => n.id !== selNode.id).map((n) => ({ value: n.id, label: n.title || "Tanpa judul" })),
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!linkTarget}
                      onClick={() => {
                        connect(selNode.id, linkTarget);
                        setLinkTarget("");
                      }}
                      className="h-11 rounded-xl bg-ground px-3 text-[13px] font-bold hover:bg-[#e8e7ef] disabled:text-muted"
                    >
                      Sambung
                    </button>
                  </div>
                </div>
              )}
              <DangerButton onClick={() => removeNode(selNode.id)}>Hapus kartu</DangerButton>
            </>
          ) : selEdge ? (
            <>
              <PanelHead label="Sambungan" onDone={() => setSel(null)} />
              <dl className="flex flex-col gap-1.5 text-[14px]">
                <div>
                  <dt className="text-[11px] font-semibold text-muted">Dari</dt>
                  <dd className="font-bold">{byId.get(selEdge.from)?.title || "Tanpa judul"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-muted">Ke</dt>
                  <dd className="font-bold">{byId.get(selEdge.to)?.title || "Tanpa judul"}</dd>
                </div>
              </dl>
              <Text label="Label sambungan" value={selEdge.label} max={80} placeholder="Misal: warna ikut ini" onChange={(v) => updEdge(selEdge.id, { label: v })} />
              <DangerButton onClick={() => removeEdge(selEdge.id)}>Hapus sambungan</DangerButton>
            </>
          ) : selGroup ? (
            <>
              <PanelHead label="Kelompok" onDone={() => setSel(null)} />
              <Text label="Nama kelompok" value={selGroup.title} max={80} placeholder="Misal: Pelaminan dan dekor" onChange={(v) => updGroup(selGroup.id, { title: v })} />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[12px] font-semibold text-muted">Warna latar</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(MOOD_GROUP_COLORS).map(([k, c]) => {
                    const on = selGroup.color === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updGroup(selGroup.id, { color: k })}
                        className={cx("hit-44 flex h-9 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[12px] font-semibold", on ? "border-ink" : "border-line")}
                      >
                        <span className="size-3 rounded-full" style={{ background: c.bg, border: `1.5px solid ${c.line}` }} aria-hidden="true" />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <p className="text-[13px] leading-[1.5] text-muted">
                {b.nodes.filter((n) => inside(n, selGroup)).length} kartu di dalam kelompok ini. Kartu ikut berpindah saat kelompok digeser.
              </p>
              <div className="mt-auto flex flex-col gap-1.5">
                <DangerButton onClick={() => removeGroup(selGroup.id)}>Hapus kelompok</DangerButton>
                <p className="text-center text-[12px] text-muted">Kartu di dalamnya tidak ikut terhapus.</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] font-extrabold">{boardName}</h2>
                <p className="text-[13px] text-muted">
                  {b.nodes.length} kartu dan {b.groups.length} kelompok
                </p>
              </div>
              {b.nodes.length > 0 && (
                <nav aria-label="Kartu di papan ini" className="flex flex-col gap-1">
                  {b.nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setSel({ kind: "node", id: n.id });
                        reveal(n);
                      }}
                      className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-[13px] font-semibold hover:bg-ground"
                    >
                      <span className="w-14 shrink-0 text-[11px] text-muted">{{ photo: "Foto", note: "Catatan", palette: "Palet" }[n.type]}</span>
                      <span className="truncate">{n.title || "Tanpa judul"}</span>
                    </button>
                  ))}
                </nav>
              )}
              <div id="mb-help" className="flex flex-col gap-3 text-[13px] leading-[1.5]">
                <Help title="Susun">Tarik kartu untuk memindah, tarik area kosong untuk menggeser kanvas. Ctrl dan scroll, atau cubit dua jari, untuk zoom.</Help>
                <Help title="Kelompokkan">Kelompok membuat area bernama, misalnya Pelaminan atau Busana. Kartu di dalamnya ikut berpindah saat kelompok digeser.</Help>
                <Help title="Sambungkan ide">Tarik titik di sisi kartu ke kartu lain, lalu beri label pada sambungannya.</Help>
                <Help title="Keyboard">V untuk Pilih, C untuk Sambung, tombol panah untuk menggeser kartu terpilih, Delete untuk menghapus, Esc untuk batal.</Help>
              </div>
            </>
          )}
        </aside>
      </div>
      <PhotoViewer photos={b.nodes.filter((n) => n.type === "photo" && (n.fileId || n.preview))} openId={viewer} onChange={setViewer} />
    </div>
  );
}

const photoSrc = (n: LocalNode) => n.preview ?? (n.fileId ? `/api/files/${n.fileId}` : null);
const photoStyle = (n: LocalNode) => ({
  objectFit: n.fit ?? "cover",
  objectPosition: `${n.focus?.x ?? 50}% ${n.focus?.y ?? 50}%`,
});

/** Luminans relatif (WCAG) dari hex 6 digit. */
function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * Kartu palet memakai BrandingCard dari 21st.dev. "Aa" ditulis dengan warna tergelap di palet
 * sebagai pratinjau warna teks; bila warna itu terlalu terang di atas putih (< 3:1), dipakai ink.
 */
function PaletteCard({ n }: { n: LocalNode }) {
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

function PhotoCard({ n, showOpen, onOpen }: { n: LocalNode; showOpen: boolean; onOpen: () => void }) {
  const src = photoSrc(n);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative h-[150px] shrink-0 bg-[#e8e7ef]">
        {src ? (
          // Foto dari penyimpanan privat lewat /api/files, jadi tidak lewat optimasi next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={n.title} draggable={false} className="pointer-events-none block size-full" style={photoStyle(n)} />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] font-semibold text-muted">Foto belum ada</div>
        )}
        {n.uploading && <span className="absolute bottom-2 left-2 rounded-md bg-ink px-2 py-[3px] text-[11px] font-bold text-white">Mengunggah…</span>}
        {src && (
          <button
            type="button"
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
      <div className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
        <div className="shrink-0 truncate text-[13px] font-bold leading-[1.4]">{n.title || "Tanpa judul"}</div>
        <div className="flex shrink-0 gap-1 overflow-hidden">
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

/** Pengatur tampilan foto di panel detail: isi kartu atau utuh, dan titik fokus untuk mode isi kartu. */
function PhotoAdjust({ n, onChange, onOpen }: { n: LocalNode; onChange: (p: Partial<LocalNode>) => void; onOpen: () => void }) {
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
            <img src={photoSrc(n)!} alt="" draggable={false} className="pointer-events-none block h-auto w-full" />
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

/** Dialog foto penuh, dengan pindah ke foto sebelumnya dan berikutnya di papan yang sama. */
function PhotoViewer({ photos, openId, onChange }: { photos: LocalNode[]; openId: string | null; onChange: (id: string | null) => void }) {
  const i = photos.findIndex((p) => p.id === openId);
  const n = i >= 0 ? photos[i] : null;
  const go = (d: number) => {
    if (photos.length < 2) return;
    onChange(photos[(i + d + photos.length) % photos.length].id);
  };
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
          <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-ground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc(n)!} alt={n.title} className="block max-h-[68dvh] w-auto max-w-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {n.tags.map((t) => (
              <span key={t} className="rounded-md bg-ground px-2 py-[3px] text-[11px] font-bold">
                {t}
              </span>
            ))}
            <div className="flex-1" />
            {n.fileId && (
              <a
                href={`/api/files/${n.fileId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold no-underline hover:bg-ground"
              >
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

function ToolButton({ label, hint, icon, on, onClick, disabled }: { label: string; hint: string; icon: React.ReactNode; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={hint}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-[52px] w-14 flex-col items-center justify-center gap-[3px] rounded-xl text-[11px] font-bold transition-colors duration-150 disabled:text-muted",
        on ? "bg-accent text-ink" : "hover:bg-ground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PanelHead({ label, onDone }: { label: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[13px] font-bold text-muted">{label}</h2>
      <button type="button" onClick={onDone} className="h-10 rounded-lg bg-ground px-3 text-[12px] font-bold hover:bg-[#e8e7ef]">
        Selesai
      </button>
    </div>
  );
}

function Text({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <Input type="text" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-auto h-11 rounded-xl border border-[#f1c9c4] text-[13px] font-bold text-danger hover:bg-[#fdf1ef]">
      {children}
    </button>
  );
}

function Help({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold">{title}</div>
      <div className="text-muted">{children}</div>
    </div>
  );
}
