"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import Link from "next/link";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Group,
  Circle,
  Eraser,
  ExternalLink,
  Hand,
  Image as ImageIcon,
  Link2,
  Minus,
  MousePointer2,
  NotebookPen,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
  Redo2,
  Share2,
  Slash,
  Spline,
  Square,
  SquareDashed,
  Type,
  Undo2,
  Ungroup,
} from "lucide-react";
import type { MoodData, MoodEdge, MoodGroup, MoodMedia, MoodNode } from "@/db/schema";
import { setMoodboardShare } from "@/actions/moodboard";
import {
  applyOps,
  MOOD_BOARDS,
  MOOD_GROUP_COLORS,
  MOOD_LIMITS,
  MOOD_TAG_MAX,
  MOOD_TAGS,
  type MoodBoardId,
  type MoodMoving,
  type MoodOp,
  type MoodRect,
  presenceColor,
  sourceName,
  toSet,
} from "@/lib/moodboard";
import { cx, Input, Textarea } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { Modal } from "@/components/forms";
import { ColorField } from "@/components/color-field";
import { CopyLink } from "@/components/copy-link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  boxOf,
  contentBounds,
  curve,
  DEFAULT_SIZE,
  EdgeLabel,
  insideRect,
  isCard,
  isStroke,
  MEDIA_FOOTER,
  MediaCard,
  mediaRatio,
  NoteCard,
  overlaps,
  PaletteCard,
  PhotoCard,
  PhotoViewer,
  StrokeBody,
  TextBody,
  textStyle,
} from "./board-view";
import { useMoodSync } from "./use-mood-sync";
import { useNoPageZoom } from "./no-page-zoom";
import { record, step, type History } from "./history";
import { polyDist, simplify, toLocal } from "./ink";
import { Cursors, firstName, PeerAvatars, PeerSelections } from "./presence";
import { DangerButton, GeometryFields, Help, IconAction, PanelHead, PhotoAdjust, Section, StrokePanel, TextField, TextPanel, ToolOptions, type InkStyle } from "./panels";
import { groupOwners, LayersPanel } from "./layers";

type Tool = "select" | "hand" | "link" | "pen" | "eraser" | "shape" | "text";
type ShapeKind = "rect" | "ellipse" | "line" | "arrow";
type Sel = { kind: "node" | "edge" | "group"; ids: string[] } | null;
type Corner = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "pinch"; d0: number; zoom0: number; wx: number; wy: number }
  | { kind: "move"; x0: number; y0: number; nodes: Record<string, { x: number; y: number }>; groups: Record<string, { x: number; y: number }>; moved: boolean }
  | { kind: "resize"; id: string; coll: "nodes" | "groups"; corner: Corner; x0: number; y0: number; r: MoodRect }
  | { kind: "link"; from: string }
  | { kind: "marquee"; x0: number; y0: number; base: string[] }
  | { kind: "pen"; pts: number[] }
  | { kind: "eraser" }
  | { kind: "shape"; x0: number; y0: number };
type Draft =
  | { kind: "link"; from: string; x: number; y: number }
  | { kind: "marquee"; r: MoodRect }
  | { kind: "pen"; pts: number[] }
  | { kind: "shape"; r: MoodRect; line: number[] }
  | null;
// Foto yang sedang diunggah. Foto baru belum masuk papan (belum ada fileId), jadi tampil sebagai kartu sementara.
type Upload = { board: string; node: MoodNode; url: string };
// Link yang sedang diambil server, tampil sebagai kartu sementara di tempat kartu medianya nanti.
type Pending = { board: string; x: number; y: number; source: string };

const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO = 10 * 1024 * 1024;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const PAN0 = { x: 96, y: 24 };
// Tinggi toolbar alat di bawah kanvas (dengan jaraknya): area kerja dihitung tanpa bagian ini supaya kartu tidak tertutup.
const BOTTOM = 80;
const MIN_SIZE: Record<string, { w: number; h: number }> = {
  photo: { w: 140, h: 140 },
  note: { w: 140, h: 90 },
  palette: { w: 260, h: 236 },
  text: { w: 60, h: 10 },
  shape: { w: 8, h: 8 },
  draw: { w: 8, h: 8 },
  media: { w: 140, h: 140 },
  group: { w: 240, h: 140 },
};
const TYPE_LABEL: Record<string, string> = { photo: "Foto", note: "Catatan", palette: "Palet", text: "Teks", shape: "Bentuk", draw: "Gambar", media: "Link" };
const PANEL_LABEL: Record<string, string> = { photo: "Foto referensi", note: "Catatan", palette: "Palet warna", text: "Teks", shape: "Bentuk", draw: "Gambar pena", media: "Dari link" };
// Kartu media baru: lebar bawaan, dan tinggi foto paling besar supaya foto yang sangat tinggi tidak memenuhi layar.
const MEDIA_W = { portrait: 260, landscape: 320 };
const MEDIA_MAX_H = 520;
const isLink = (t: string) => /^https?:\/\/\S+$/i.test(t);
const SHAPES: { k: ShapeKind; name: string; icon: React.ReactNode }[] = [
  { k: "rect", name: "Kotak", icon: <Square size={18} aria-hidden="true" /> },
  { k: "ellipse", name: "Lingkaran", icon: <Circle size={18} aria-hidden="true" /> },
  { k: "line", name: "Garis", icon: <Slash size={18} aria-hidden="true" /> },
  { k: "arrow", name: "Panah", icon: <ArrowUpRight size={18} aria-hidden="true" /> },
];
const SAVE_TEXT = { saved: "Tersimpan", saving: "Menyimpan…", error: "Ada yang gagal disimpan", offline: "Offline, mencoba lagi…" };

const uid = () => crypto.randomUUID();

/** Ukuran asli foto atau video dari server, untuk link yang tidak menyebut ukurannya. */
function naturalSize(src: string, kind: MoodMedia["kind"]) {
  return new Promise<{ w: number; h: number }>((resolve) => {
    const done = (w: number, h: number) => resolve(w && h ? { w, h } : { w: 4, h: 5 });
    if (kind === "video") {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
      v.onerror = () => done(0, 0);
      v.src = src;
    } else {
      const i = new Image();
      i.onload = () => done(i.naturalWidth, i.naturalHeight);
      i.onerror = () => done(0, 0);
      i.src = src;
    }
    setTimeout(() => done(0, 0), 15_000);
  });
}

/** Kursor sendiri saat ada anggota lain di papan: panah berwarna sama dengan yang mereka lihat. */
function cursorCss(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" viewBox="0 0 18 20"><path d="M1.5 1.5 L16 10.2 L9.4 11.6 L6 18.2 Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, default`;
}
const r1 = (v: number) => Math.round(v);
function nodeLabel(n: MoodNode) {
  // Nama dari panel Layer berlaku untuk semua jenis; tanpa nama, dipakai label bawaan per jenis.
  if (n.title && !isCard(n)) return n.title;
  if (n.type === "draw") return "Goresan pena";
  if (n.type === "shape") return SHAPES.find((s) => s.k === n.shape)?.name ?? "Bentuk";
  if (n.type === "text") return (n.text ?? "").split("\n")[0].slice(0, 40) || "Teks kosong";
  return n.title || "Tanpa judul";
}

/** Gabungkan posisi sementara (sedang digeser, milik sendiri atau anggota lain) ke isi papan untuk ditampilkan. */
function overlay(d: MoodData, m: MoodMoving): MoodData {
  if (!Object.keys(m).length) return d;
  return {
    ...d,
    nodes: d.nodes.map((n) => (m[n.id] ? { ...n, ...m[n.id] } : n)),
    groups: d.groups.map((g) => (m[g.id] ? { ...g, ...m[g.id] } : g)),
  };
}

export function MoodboardCanvas({
  initial,
  initialRev,
  initialShare,
  me,
}: {
  initial: Record<MoodBoardId, MoodData>;
  initialRev: Record<MoodBoardId, number>;
  initialShare: Record<MoodBoardId, string | null>;
  me: { id: string; name: string };
}) {
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  const sync = useMoodSync(initial, initialRev, flash);
  const { boards, presence } = sync;
  const [active, setActive] = useState<MoodBoardId>("utama");
  const [tool, setTool] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [style, setStyle] = useState<InkStyle>({ color: "#1c1b29", strokeWidth: 4, font: "caveat", fontSize: 32 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(PAN0);
  const [sel, setSel] = useState<Sel>(null);
  const [preview, setPreview] = useState<MoodMoving>({});
  const [draft, setDraft] = useState<Draft>(null);
  const [erasing, setErasing] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Record<string, Upload>>({});
  const [imports, setImports] = useState<Record<string, Pending>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [spaceDown, setSpaceDown] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [newTag, setNewTag] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);
  const [share, setShare] = useState(initialShare);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Tinggi teks bebas mengikuti isinya, diukur dari DOM (dipakai untuk sambungan, pilihan kotak, dan pegangan).
  const [textH, setTextH] = useState<Record<string, number>>({});
  const [hist, setHist] = useState({ undo: false, redo: false });

  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Ketukan terakhir pada elemen, untuk mendeteksi klik dua kali (dblclick bawaan hilang karena pointer ditangkap kanvas).
  const lastTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const history = useRef<History>({});
  // Isi papan terbaru tanpa menunggu render, supaya beberapa perubahan beruntun dihitung dari keadaan yang benar.
  const boardsRef = useRef(boards);
  // Papan yang sedang dibuka, untuk pekerjaan yang selesai belakangan (impor link) setelah pindah papan.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  /* ---------- Turunan ---------- */

  const peersAll = Object.values(sync.peers);
  const peers = peersAll.filter((p) => p.board === active);
  const peerMoving = Object.assign({}, ...peers.map((p) => p.moving ?? {})) as MoodMoving;
  const raw = boards[active];
  const b = overlay(raw, { ...peerMoving, ...preview });
  const byId = new Map(b.nodes.map((n) => [n.id, n]));
  const box = (n: MoodNode) => boxOf(n, textH[n.id]);
  const boxById = (id: string) => {
    const n = byId.get(id);
    if (n) return box(n);
    return b.groups.find((g) => g.id === id) ?? null;
  };
  const boardColors = [...new Set(b.nodes.flatMap((n) => [...(n.swatches ?? []), ...(n.color ? [n.color] : [])]))];
  const allTags = [...new Set([...MOOD_TAGS, ...Object.values(boards).flatMap((d) => d.nodes.flatMap((n) => n.tags))])];
  const selIds = sel?.ids ?? [];
  const selNodes = sel?.kind === "node" ? selIds.map((id) => byId.get(id)).filter((n): n is MoodNode => !!n) : [];
  const selNode = selNodes.length === 1 ? selNodes[0] : undefined;
  const selEdge = sel?.kind === "edge" ? b.edges.find((x) => x.id === selIds[0]) : undefined;
  const selGroup = sel?.kind === "group" ? b.groups.find((x) => x.id === selIds[0]) : undefined;
  const boardName = MOOD_BOARDS.find((x) => x.id === active)!.name;
  const followed = following ? sync.peers[following] : undefined;
  const owners = groupOwners(b, box);
  // Yang tersembunyi dari panel Layer tidak digambar di kanvas; yang terkunci tidak bisa dipilih atau digeser di kanvas.
  const shownNodes = b.nodes.filter((n) => !n.hidden);
  const shownIds = new Set(shownNodes.map((n) => n.id));
  const pickable = (n: MoodNode) => !n.hidden && !n.locked;

  /* ---------- Menyimpan perubahan ---------- */

  const syncHist = (boardId: string) => {
    const h = history.current[boardId];
    setHist({ undo: !!h?.past.length, redo: !!h?.future.length });
  };

  function commit(ops: MoodOp[], key?: string, boardId: string = active) {
    if (!ops.length) return;
    const before = boardsRef.current[boardId];
    record(history.current, boardId, before, ops, key);
    boardsRef.current = { ...boardsRef.current, [boardId]: applyOps(before, ops) };
    sync.commit(boardId, ops);
    if (boardId === active) syncHist(boardId);
  }

  function undo(dir: "undo" | "redo") {
    const ops = step(history.current, active, dir);
    syncHist(active);
    if (!ops) return;
    boardsRef.current = { ...boardsRef.current, [active]: applyOps(boardsRef.current[active], ops) };
    sync.commit(active, ops);
    setEditing(null);
  }

  const current = (id: string, boardId: string = active) => boardsRef.current[boardId].nodes.find((n) => n.id === id);
  function patchNode(id: string, patch: Partial<MoodNode>, key?: string, boardId: string = active) {
    const n = current(id, boardId);
    if (n) commit([{ t: "patch", c: "nodes", id, set: toSet(patch) }], key, boardId);
  }
  function patchEdge(id: string, patch: Partial<MoodEdge>, key?: string) {
    const e = boardsRef.current[active].edges.find((x) => x.id === id);
    if (e) commit([{ t: "patch", c: "edges", id, set: toSet(patch) }], key);
  }
  function patchGroup(id: string, patch: Partial<MoodGroup>, key?: string) {
    const g = boardsRef.current[active].groups.find((x) => x.id === id);
    if (g) commit([{ t: "patch", c: "groups", id, set: toSet(patch) }], key);
  }
  /** Ubah satu atribut di semua elemen terpilih sekaligus (satu langkah undo). */
  function patchSelected(patch: Partial<MoodNode>, key?: string) {
    const ops: MoodOp[] = [];
    for (const n of selNodes) {
      const cur = current(n.id);
      if (cur) ops.push({ t: "patch", c: "nodes", id: n.id, set: toSet(patch) });
    }
    commit(ops, key);
  }
  function removeSelection() {
    if (!sel) return;
    const c = sel.kind === "node" ? "nodes" : sel.kind === "edge" ? "edges" : "groups";
    commit(sel.ids.map((id) => ({ t: "del", c, id })));
    setSel(null);
    setEditing(null);
  }
  function duplicateSelection() {
    if (sel?.kind !== "node" || !selNodes.length) return;
    if (raw.nodes.length + selNodes.length > MOOD_LIMITS.nodes) return flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
    const copies = selNodes.map((n) => ({ ...(current(n.id) ?? n), id: uid(), x: n.x + 24, y: n.y + 24 }));
    commit(copies.map((item) => ({ t: "put", c: "nodes", item })));
    setSel({ kind: "node", ids: copies.map((c) => c.id) });
  }
  /**
   * Pindah lapisan elemen terpilih: paling depan, maju satu, mundur satu, atau paling belakang.
   * Urutan sesama elemen terpilih tetap; elemen yang sudah di ujung tidak bergerak.
   */
  function restack(dir: "front" | "forward" | "backward" | "back") {
    const order = boardsRef.current[active].nodes.map((n) => n.id);
    const chosen = new Set(selIds);
    const up = dir === "front" || dir === "forward";
    const ids = order.filter((id) => chosen.has(id));
    if (up) ids.reverse();
    const ops: MoodOp[] = [];
    let edge = up ? order.length - 1 : 0;
    for (const id of ids) {
      const i = order.indexOf(id);
      let j = dir === "front" || dir === "back" ? edge : i + (up ? 1 : -1);
      if (dir === "forward" || dir === "backward") {
        if (j < 0 || j >= order.length || chosen.has(order[j])) continue;
      }
      edge += up ? -1 : 1;
      if (j === i) continue;
      j = Math.max(0, Math.min(order.length - 1, j));
      order.splice(i, 1);
      order.splice(j, 0, id);
      ops.push({ t: "z", id, to: j });
    }
    commit(ops);
  }

  /** Taruh elemen tepat di atas atau di bawah elemen lain (seret di panel Layer). */
  function reorderLayer(id: string, target: string, above: boolean) {
    const rest = boardsRef.current[active].nodes.filter((n) => n.id !== id);
    const i = rest.findIndex((n) => n.id === target);
    if (i >= 0) commit([{ t: "z", id, to: above ? i + 1 : i }]);
  }

  /** Kelompokkan elemen terpilih: kelompok baru dibuat pas mengelilinginya, dengan ruang untuk nama di atas. */
  function groupSelection() {
    if (sel?.kind !== "node" || !selNodes.length) return flash("Pilih elemen yang mau dikelompokkan dulu.");
    if (raw.groups.length >= MOOD_LIMITS.groups) return flash(`Papan ini sudah berisi ${MOOD_LIMITS.groups} kelompok.`);
    const rs = selNodes.map(box);
    const x0 = Math.min(...rs.map((r) => r.x)) - 24;
    const y0 = Math.min(...rs.map((r) => r.y)) - 52;
    const x1 = Math.max(...rs.map((r) => r.x + r.w)) + 24;
    const y1 = Math.max(...rs.map((r) => r.y + r.h)) + 24;
    const g: MoodGroup = { id: uid(), title: "Kelompok baru", color: "netral", x: r1(x0), y: r1(y0), w: Math.max(MIN_SIZE.group.w, r1(x1 - x0)), h: Math.max(MIN_SIZE.group.h, r1(y1 - y0)) };
    commit([{ t: "put", c: "groups", item: g }]);
    setSel({ kind: "group", ids: [g.id] });
  }

  /** Lepas kelompok: kotaknya dihapus, isinya tetap di tempat dan langsung terpilih. */
  function ungroup(ids: string[]) {
    if (!ids.length) return;
    const kids = b.nodes.filter((n) => ids.includes(owners.get(n.id) ?? "")).map((n) => n.id);
    commit(ids.map((id) => ({ t: "del", c: "groups", id })));
    setSel(kids.length ? { kind: "node", ids: kids } : null);
  }

  function toggleLayer(kind: "node" | "group", id: string, key: "locked" | "hidden") {
    const d = boardsRef.current[active];
    const item = kind === "node" ? d.nodes.find((x) => x.id === id) : d.groups.find((x) => x.id === id);
    if (!item) return;
    commit([{ t: "patch", c: kind === "node" ? "nodes" : "groups", id, set: toSet({ [key]: item[key] ? undefined : true }) }]);
  }

  function selectLayer(kind: "node" | "group", id: string, additive: boolean) {
    setFollowing(null);
    setEditing(null);
    if (additive && sel?.kind === kind) setSel({ kind, ids: sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id] });
    else setSel({ kind, ids: [id] });
    // Geser tampilan hanya bila elemen di luar layar, supaya memilih dari daftar tidak membuat kanvas melompat.
    const r = boxById(id);
    const v = viewSize();
    if (r && (r.x * zoom + pan.x > v.w || (r.x + r.w) * zoom + pan.x < 0 || r.y * zoom + pan.y > v.h - BOTTOM || (r.y + r.h) * zoom + pan.y < 0)) reveal(r);
  }

  /** Ratakan elemen terpilih ke tepi atau tengah kotak gabungannya. */
  function alignSelected(how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    const rs = selNodes.map((n) => ({ n, r: box(n) }));
    const x0 = Math.min(...rs.map(({ r }) => r.x));
    const x1 = Math.max(...rs.map(({ r }) => r.x + r.w));
    const y0 = Math.min(...rs.map(({ r }) => r.y));
    const y1 = Math.max(...rs.map(({ r }) => r.y + r.h));
    const ops: MoodOp[] = [];
    for (const { n, r } of rs) {
      if (n.locked) continue;
      const set =
        how === "left"
          ? { x: x0 }
          : how === "right"
            ? { x: x1 - r.w }
            : how === "hcenter"
              ? { x: r1((x0 + x1) / 2 - r.w / 2) }
              : how === "top"
                ? { y: y0 }
                : how === "bottom"
                  ? { y: y1 - r.h }
                  : { y: r1((y0 + y1) / 2 - r.h / 2) };
      ops.push({ t: "patch", c: "nodes", id: n.id, set });
    }
    commit(ops);
  }

  /** X, Y, lebar, tinggi dari panel kanan. Kartu media menjaga rasio foto, teks menjaga tinggi isinya. */
  function setGeometry(n: MoodNode, p: Partial<MoodRect>) {
    const min = MIN_SIZE[n.type] ?? MIN_SIZE.shape;
    const next: Partial<MoodNode> = {};
    if (p.x !== undefined) next.x = p.x;
    if (p.y !== undefined) next.y = p.y;
    if (p.w !== undefined) next.w = Math.max(min.w, p.w);
    if (p.h !== undefined && n.type !== "text") next.h = Math.max(min.h, p.h);
    if (n.type === "media" && next.w !== undefined) next.h = Math.round(next.w * mediaRatio(n)) + MEDIA_FOOTER;
    // Gambar dan bentuk tanpa ukuran tersimpan memakai ukuran kotaknya, jadi tinggi atau lebar yang tidak diubah ikut ditulis.
    if ((next.w !== undefined || next.h !== undefined) && n.type !== "text") {
      const r = box(n);
      next.w ??= r.w;
      next.h ??= r.h;
    }
    patchNode(n.id, next, `geo:${n.id}:${Object.keys(p).join()}`);
  }
  function setGroupGeometry(g: MoodGroup, p: Partial<MoodRect>) {
    patchGroup(
      g.id,
      { ...p, ...(p.w !== undefined && { w: Math.max(MIN_SIZE.group.w, p.w) }), ...(p.h !== undefined && { h: Math.max(MIN_SIZE.group.h, p.h) }) },
      `geo:${g.id}:${Object.keys(p).join()}`,
    );
  }

  function connect(from: string, to: string) {
    if (from === to) return;
    if (raw.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) return flash("Kedua elemen sudah tersambung.");
    const id = uid();
    commit([{ t: "put", c: "edges", item: { id, from, to, label: "" } }]);
    setSel({ kind: "edge", ids: [id] });
  }

  /* ---------- Tampilan: zoom, geser, paskan ---------- */

  function viewSize() {
    const r = boardRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 800, h: r?.height ?? 600 };
  }
  function world(clientX: number, clientY: number) {
    const r = boardRef.current!.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    return { sx, sy, x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  }
  /** Titik tengah area kerja (di kanan toolbar) dalam koordinat papan. */
  function center(w = 240, h = 200) {
    const v = viewSize();
    return { x: r1((v.w / 2 - pan.x) / zoom - w / 2), y: r1(((v.h - BOTTOM) / 2 - pan.y) / zoom - h / 2) };
  }
  /** Tempat kosong terdekat dari tengah layar, supaya kartu baru tidak menumpuk di atas kartu lain. */
  function freeSpot(w: number, h: number) {
    const c = center(w, h);
    const hits = (x: number, y: number) => b.nodes.some((n) => overlaps({ x: x - 16, y: y - 16, w: w + 32, h: h + 32 }, box(n)));
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
  function zoomAt(z: number, sx: number, sy: number) {
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    const wx = (sx - pan.x) / zoom;
    const wy = (sy - pan.y) / zoom;
    setZoom(nz);
    setPan({ x: sx - wx * nz, y: sy - wy * nz });
  }
  const zoomStep = (d: number) => {
    const v = viewSize();
    setFollowing(null);
    zoomAt(Math.round((zoom + d) * 10) / 10, v.w / 2, v.h / 2);
  };
  /** Tampilkan kotak `r` di tengah area kerja. `pad` memberi jarak tepi (untuk Paskan), tanpa jarak untuk mengikuti anggota. */
  function showRect(r: MoodRect, maxZoom = 1.2, pad = true) {
    const v = viewSize();
    const z = Math.max(ZOOM_MIN, Math.min(maxZoom, Math.min((v.w - (pad ? 48 : 0)) / r.w, (v.h - BOTTOM - (pad ? 48 : 0)) / r.h)));
    setZoom(z);
    setPan({ x: v.w / 2 - (r.x + r.w / 2) * z, y: (v.h - BOTTOM) / 2 - (r.y + r.h / 2) * z });
  }
  function fit(d: MoodData = b) {
    const r = contentBounds(d, box);
    if (!r) {
      setZoom(1);
      setPan(PAN0);
      return;
    }
    showRect(r);
  }
  /** Geser tampilan supaya kotak `r` ada di tengah area kerja (dipakai dari panel Layer). */
  function reveal(r: MoodRect) {
    const v = viewSize();
    setPan({ x: v.w / 2 - (r.x + r.w / 2) * zoom, y: (v.h - BOTTOM) / 2 - (r.y + r.h / 2) * zoom });
  }
  function pickBoard(id: MoodBoardId, doFit = true) {
    setActive(id);
    setSel(null);
    setEditing(null);
    setPreview({});
    drag.current = null;
    const h = history.current[id];
    setHist({ undo: !!h?.past.length, redo: !!h?.future.length });
    if (doFit) fit(boards[id]);
  }

  useNoPageZoom(boardRef, (f, cx2, cy2) => {
    const r = boardRef.current!.getBoundingClientRect();
    setFollowing(null);
    zoomAt(f === null ? 1 : zoom * f, cx2 - r.left, cy2 - r.top);
  });

  // Saat halaman dibuka, paskan tampilan ke isi papan supaya tidak ada kartu yang terpotong di layar sempit.
  // Di layar di bawah 1280px panel Layer mulai tertutup supaya kanvas tetap lega.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fit();
  });
  useEffect(() => {
    // Lebar layar baru diketahui di browser, jadi disamakan setelah render pertama.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth < 1280) setLayersOpen(false);
  }, []);

  /* ---------- Kehadiran: kirim tampilan, pilihan, ikuti anggota ---------- */

  useEffect(() => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return;
    presence({ board: active, view: { x: -pan.x / zoom, y: -pan.y / zoom, w: r.width / zoom, h: (r.height - BOTTOM) / zoom } });
  }, [active, pan, zoom, presence]);
  useEffect(() => {
    presence({ board: active, sel: sel?.kind === "node" || sel?.kind === "group" ? sel.ids : [] });
  }, [active, sel, presence]);

  // Mengikuti anggota: pindah ke papannya dan tampilkan area yang sedang ia lihat.
  const followView = followed?.view;
  const followBoard = followed?.board;
  useEffect(() => {
    // Anggota yang diikuti sudah pergi: `followed` kosong, chip dan bingkai hilang dengan sendirinya.
    if (!following || !followBoard) return;
    // Menyamakan tampilan dengan data dari luar (kehadiran anggota lain lewat jaringan), bukan turunan state sendiri.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (followBoard !== active) pickBoard(followBoard as MoodBoardId, false);
    if (followView) showRect(followView, ZOOM_MAX, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following, followBoard, followView?.x, followView?.y, followView?.w, followView?.h]);

  /* ---------- Menambah elemen ---------- */

  function addNode(n: Omit<MoodNode, "id" | "x" | "y" | "tags">, at?: { x: number; y: number }) {
    if (raw.nodes.length >= MOOD_LIMITS.nodes) {
      flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
      return null;
    }
    const id = uid();
    const d = DEFAULT_SIZE[n.type];
    const pos = at ?? freeSpot(n.w ?? d.w, n.h ?? d.h);
    commit([{ t: "put", c: "nodes", item: { id, tags: [], ...n, ...pos } }]);
    setSel({ kind: "node", ids: [id] });
    return id;
  }
  function addGroup() {
    if (raw.groups.length >= MOOD_LIMITS.groups) return flash(`Papan ini sudah berisi ${MOOD_LIMITS.groups} kelompok.`);
    const id = uid();
    const c = center(560, 320);
    commit([{ t: "put", c: "groups", item: { id, title: "Kelompok baru", color: "netral", x: c.x, y: c.y, w: 560, h: 320 } }]);
    setSel({ kind: "group", ids: [id] });
    setTool("select");
  }
  function starterGroups() {
    const g = (title: string, color: string, x: number, y: number, w: number, h: number): MoodGroup => ({ id: uid(), title, color, x, y, w, h });
    const groups = [g("Dekor dan pelaminan", "netral", 0, 0, 880, 320), g("Busana", "lavender", 0, 350, 560, 300), g("Warna dan bunga", "krem", 590, 350, 290, 300)];
    commit(groups.map((item) => ({ t: "put", c: "groups", item })));
    setSel({ kind: "group", ids: [groups[0].id] });
    fit({ ...raw, groups: [...raw.groups, ...groups] });
  }
  function addText(at: { x: number; y: number }) {
    const id = addNode({ type: "text", title: "", text: "", font: style.font, fontSize: style.fontSize, color: style.color, w: 280 }, at);
    if (id) setEditing(id);
    setTool("select");
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
  const dropUpload = (id: string) =>
    setUploads((u) => {
      const next = { ...u };
      delete next[id];
      return next;
    });
  function addPhotos(files: FileList | File[] | null, at?: { x: number; y: number }) {
    const list = Array.from(files ?? []);
    const boardId = active;
    const base = at ?? freeSpot(240, 222);
    let i = 0;
    for (const f of list) {
      const err = checkPhoto(f);
      if (err) {
        flash(err);
        continue;
      }
      if (raw.nodes.length + i >= MOOD_LIMITS.nodes) {
        flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
        break;
      }
      const node: MoodNode = { id: uid(), type: "photo", title: f.name.replace(/\.[^.]+$/, "").slice(0, 120), tags: [], x: base.x + i * 28, y: base.y + i * 28 };
      i++;
      setUploads((u) => ({ ...u, [node.id]: { board: boardId, node, url: URL.createObjectURL(f) } }));
      uploadPhoto(f)
        .then((fileId) => {
          commit([{ t: "put", c: "nodes", item: { ...node, fileId } }], undefined, boardId);
          dropUpload(node.id);
        })
        .catch((e: Error) => {
          dropUpload(node.id);
          flash(`${f.name} belum terunggah. ${e.message}`);
        });
    }
  }
  function replacePhoto(id: string, f: File | undefined) {
    if (!f) return;
    const err = checkPhoto(f);
    if (err) return flash(err);
    const boardId = active;
    const n = current(id);
    if (!n) return;
    setUploads((u) => ({ ...u, [id]: { board: boardId, node: n, url: URL.createObjectURL(f) } }));
    uploadPhoto(f)
      .then((fileId) => patchNode(id, { fileId }, undefined, boardId))
      .catch((e: Error) => flash(`Foto belum terganti. ${e.message}`))
      .finally(() => dropUpload(id));
  }
  const photoSrc = (n: MoodNode) => uploads[n.id]?.url ?? (n.fileId ? `/api/files/${n.fileId}` : null);
  const ghosts = Object.values(uploads).filter((u) => u.board === active && !byId.has(u.node.id));
  const mediaSrc = (fileId: string) => `/api/files/${fileId}`;

  /* ---------- Link: Instagram, Pinterest, dll. ---------- */

  /**
   * Server mengunduh foto dan video dari link, lalu kartu media ditaruh dengan rasio foto pertama
   * supaya tidak ada yang terpotong. Selama menunggu, kartu sementara tampil di tempat yang sama.
   */
  async function importLink(url: string, at?: { x: number; y: number }) {
    const boardId = active;
    const pending = Object.values(imports).filter((p) => p.board === boardId).length;
    if (raw.nodes.length + pending >= MOOD_LIMITS.nodes) return flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
    const id = uid();
    const pos = at ?? freeSpot(MEDIA_W.portrait, 312);
    setImports((p) => ({ ...p, [id]: { board: boardId, ...pos, source: sourceName(url) } }));
    try {
      const res = await fetch("/api/moodboard/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Link ini tidak bisa diambil.");
      const media = data.items as MoodMedia[];
      const first = media[0];
      if (!first.w || !first.h) Object.assign(first, await naturalSize(mediaSrc(first.fileId), first.kind));
      const ratio = first.h! / first.w!;
      const w = Math.max(MIN_SIZE.media.w, Math.round(Math.min(ratio < 1 ? MEDIA_W.landscape : MEDIA_W.portrait, MEDIA_MAX_H / ratio)));
      const item: MoodNode = { id, type: "media", title: data.title ?? "", tags: [], url, media, x: pos.x, y: pos.y, w, h: Math.round(w * ratio) + MEDIA_FOOTER };
      commit([{ t: "put", c: "nodes", item }], undefined, boardId);
      if (boardId === activeRef.current) setSel({ kind: "node", ids: [id] });
    } catch (e) {
      flash(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Link belum terambil. Periksa koneksi lalu coba lagi.");
    } finally {
      setImports((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }
  const importGhosts = Object.entries(imports).filter(([, p]) => p.board === active);

  /* ---------- Pointer ---------- */

  function startDrag(e: ReactPointerEvent, d: Drag) {
    drag.current = d;
    boardRef.current?.setPointerCapture(e.pointerId);
  }
  // Geser kanvas: alat Tangan, Spasi ditahan, tombol tengah mouse, atau satu jari di tablet saat alat Pilih.
  const panning = (e: ReactPointerEvent) => tool === "hand" || spaceDown || e.button === 1 || (tool === "select" && e.pointerType === "touch");

  function onPointerDownCapture(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Dua jari di tablet: cubit untuk zoom dan geser, apa pun yang sedang dikerjakan dibatalkan.
      const [p1, p2] = [...pointers.current.values()];
      const mid = world((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      drag.current = { kind: "pinch", d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom0: zoom, wx: mid.x, wy: mid.y };
      setDraft(null);
      setPreview({});
      setErasing([]);
      setFollowing(null);
      boardRef.current?.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }
  }

  function onBoardDown(e: ReactPointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    boardRef.current?.focus({ preventScroll: true });
    if (editing) setEditing(null);
    const p = world(e.clientX, e.clientY);
    if (panning(e) || tool === "link") {
      setFollowing(null);
      return startDrag(e, { kind: "pan", sx: p.sx, sy: p.sy, px: pan.x, py: pan.y });
    }
    if (tool === "pen") {
      startDrag(e, { kind: "pen", pts: [p.x, p.y] });
      return setDraft({ kind: "pen", pts: [p.x, p.y] });
    }
    if (tool === "eraser") {
      startDrag(e, { kind: "eraser" });
      return eraseAt(p.x, p.y);
    }
    if (tool === "shape") {
      startDrag(e, { kind: "shape", x0: p.x, y0: p.y });
      return setDraft({ kind: "shape", r: { x: p.x, y: p.y, w: 0, h: 0 }, line: [p.x, p.y, p.x, p.y] });
    }
    if (tool === "text") {
      // Tanpa ini, fokus bawaan mousedown pindah ke kanvas dan isian teks yang baru muncul langsung tertutup.
      e.preventDefault();
      return addText({ x: r1(p.x), y: r1(p.y - (style.fontSize * 1.3) / 2) });
    }
    const base = e.shiftKey && sel?.kind === "node" ? sel.ids : [];
    if (!e.shiftKey) setSel(null);
    startDrag(e, { kind: "marquee", x0: p.x, y0: p.y, base });
  }

  function startMove(e: ReactPointerEvent, nodeIds: string[], groupIds: string[]) {
    const p = world(e.clientX, e.clientY);
    const nodes: Record<string, { x: number; y: number }> = {};
    const groups: Record<string, { x: number; y: number }> = {};
    for (const id of nodeIds) {
      const n = byId.get(id);
      if (n) nodes[id] = { x: n.x, y: n.y };
    }
    for (const id of groupIds) {
      const g = b.groups.find((x) => x.id === id);
      if (!g) continue;
      groups[id] = { x: g.x, y: g.y };
      // Elemen di dalam kelompok ikut berpindah, kecuali yang terkunci.
      for (const n of b.nodes) if (!n.locked && insideRect(box(n), g)) nodes[n.id] = { x: n.x, y: n.y };
    }
    startDrag(e, { kind: "move", x0: p.x, y0: p.y, nodes, groups, moved: false });
  }

  function onNodeDown(e: ReactPointerEvent, n: MoodNode) {
    // Titik sambung di sisi elemen: tarik untuk menyambung, bukan untuk menggeser.
    const viaHandle = (e.target as HTMLElement).dataset?.linkHandle !== undefined;
    if ((e.button !== 0 && e.button !== 1) || drag.current?.kind === "pinch") return;
    // Alat gambar dan geser bekerja di atas elemen juga: biarkan kanvas yang menangani. Elemen terkunci juga.
    if (n.locked || panning(e) || tool === "pen" || tool === "eraser" || tool === "shape" || (tool === "text" && n.type !== "text")) return;
    e.stopPropagation();
    if (editing === n.id) return;
    boardRef.current?.focus({ preventScroll: true });
    if (editing) setEditing(null);
    const startEdit = () => {
      e.preventDefault();
      setSel({ kind: "node", ids: [n.id] });
      setEditing(n.id);
      setTool("select");
    };
    if (tool === "text") return startEdit();
    const prev = lastTap.current;
    const now = e.timeStamp;
    lastTap.current = { id: n.id, t: now, x: e.clientX, y: e.clientY };
    const dbl = !viaHandle && prev?.id === n.id && now - prev.t < 400 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 8;
    if (dbl) {
      lastTap.current = null;
      if (n.type === "text") return startEdit();
      if ((n.type === "photo" && photoSrc(n)) || n.type === "media") {
        setSel({ kind: "node", ids: [n.id] });
        return setViewer(n.id);
      }
    }
    const p = world(e.clientX, e.clientY);
    if (viaHandle || tool === "link") {
      setSel({ kind: "node", ids: [n.id] });
      startDrag(e, { kind: "link", from: n.id });
      return setDraft({ kind: "link", from: n.id, x: p.x, y: p.y });
    }
    if (e.shiftKey) {
      const ids = sel?.kind === "node" ? sel.ids : [];
      return setSel({ kind: "node", ids: ids.includes(n.id) ? ids.filter((x) => x !== n.id) : [...ids, n.id] });
    }
    const ids = sel?.kind === "node" && sel.ids.includes(n.id) ? sel.ids : [n.id];
    setSel({ kind: "node", ids });
    startMove(e, ids, []);
  }

  function onGroupDown(e: ReactPointerEvent, g: MoodGroup) {
    if ((e.button !== 0 && e.button !== 1) || drag.current?.kind === "pinch") return;
    if (g.locked || panning(e) || tool !== "select") return;
    e.stopPropagation();
    boardRef.current?.focus({ preventScroll: true });
    if (editing) setEditing(null);
    setSel({ kind: "group", ids: [g.id] });
    startMove(e, [], [g.id]);
  }

  function onResizeDown(e: ReactPointerEvent, id: string, coll: "nodes" | "groups", corner: Corner) {
    e.stopPropagation();
    const r = boxById(id);
    if (!r) return;
    const p = world(e.clientX, e.clientY);
    startDrag(e, { kind: "resize", id, coll, corner, x0: p.x, y0: p.y, r: { x: r.x, y: r.y, w: r.w, h: r.h } });
  }

  function eraseAt(x: number, y: number) {
    const hit = b.nodes.filter((n) => {
      if (n.type !== "draw" || !pickable(n) || erasing.includes(n.id)) return false;
      const r = box(n);
      const tol = 8 / zoom + (n.strokeWidth ?? 3) / 2;
      if (x < r.x - tol || x > r.x + r.w + tol || y < r.y - tol || y > r.y + r.h + tol) return false;
      return polyDist(x, y, n.points ?? [], r.x, r.y, r.w / (n.vw ?? r.w), r.h / (n.vh ?? r.h)) <= tol;
    });
    if (hit.length) setErasing((prev) => [...prev, ...hit.map((n) => n.id)]);
  }

  function resized(d: Extract<Drag, { kind: "resize" }>, px: number, py: number, keepRatio: boolean): MoodRect {
    const n = d.coll === "nodes" ? byId.get(d.id) : undefined;
    const min = MIN_SIZE[n?.type ?? "group"];
    const dx = px - d.x0;
    const dy = py - d.y0;
    let w = d.r.w + (d.corner.includes("e") ? dx : -dx);
    let h = d.r.h + (d.corner.includes("s") ? dy : -dy);
    if (n?.type === "media") {
      // Kartu media selalu mengikuti rasio foto pertama, jadi foto tetap utuh tanpa sisa latar.
      const ratio = mediaRatio(n);
      if (Math.abs(h - d.r.h) > Math.abs(w - d.r.w)) w = (h - MEDIA_FOOTER) / ratio;
      w = Math.max(min.w, r1(w));
      h = r1(w * ratio) + MEDIA_FOOTER;
      return { x: d.corner.includes("w") ? d.r.x + d.r.w - w : d.r.x, y: d.corner.includes("n") ? d.r.y + d.r.h - h : d.r.y, w, h };
    }
    if (n?.type === "text") h = d.r.h;
    else if (keepRatio) {
      const ratio = d.r.w / d.r.h;
      if (Math.abs(w / d.r.w) > Math.abs(h / d.r.h)) h = w / ratio;
      else w = h * ratio;
    }
    w = Math.max(min.w, r1(w));
    h = Math.max(min.h, r1(h));
    return { x: d.corner.includes("w") ? d.r.x + d.r.w - w : d.r.x, y: d.corner.includes("n") ? d.r.y + d.r.h - h : d.r.y, w, h };
  }

  function shapeRect(x0: number, y0: number, x1: number, y1: number, square: boolean): MoodRect {
    let w = x1 - x0;
    let h = y1 - y0;
    if (square) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
    }
    return { x: Math.min(x0, x0 + w), y: Math.min(y0, y0 + h), w: Math.abs(w), h: Math.abs(h) };
  }
  /** Garis dengan Shift dikunci ke kelipatan 45 derajat. */
  function lineEnd(x0: number, y0: number, x1: number, y1: number, snap: boolean) {
    if (!snap) return { x: x1, y: y1 };
    const a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4);
    const l = Math.hypot(x1 - x0, y1 - y0);
    return { x: x0 + Math.cos(a) * l, y: y0 + Math.sin(a) * l };
  }

  function onMove(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (d?.kind === "pinch") {
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
    if (e.pointerType !== "touch") presence({ board: active, cursor: { x: r1(p.x), y: r1(p.y) } });
    if (!d) return;
    if (d.kind === "pan") setPan({ x: d.px + (p.sx - d.sx), y: d.py + (p.sy - d.sy) });
    else if (d.kind === "move") {
      const dx = r1(p.x - d.x0);
      const dy = r1(p.y - d.y0);
      if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return;
      d.moved = true;
      const m: MoodMoving = {};
      for (const [id, o] of Object.entries(d.nodes)) m[id] = { x: o.x + dx, y: o.y + dy };
      for (const [id, o] of Object.entries(d.groups)) m[id] = { x: o.x + dx, y: o.y + dy };
      setPreview(m);
      presence({ board: active, moving: m });
    } else if (d.kind === "resize") {
      const m = { [d.id]: resized(d, p.x, p.y, e.shiftKey) };
      setPreview(m);
      presence({ board: active, moving: m });
    } else if (d.kind === "link") setDraft({ kind: "link", from: d.from, x: p.x, y: p.y });
    else if (d.kind === "marquee") {
      const r = { x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) };
      setDraft({ kind: "marquee", r });
      const hit = b.nodes.filter((n) => pickable(n) && overlaps(r, box(n))).map((n) => n.id);
      const ids = [...new Set([...d.base, ...hit])];
      setSel(ids.length ? { kind: "node", ids } : null);
    } else if (d.kind === "pen") {
      const lx = d.pts[d.pts.length - 2];
      const ly = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - lx, p.y - ly) * zoom < 1.5 || d.pts.length >= MOOD_LIMITS.points * 4) return;
      d.pts.push(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
      setDraft({ kind: "pen", pts: [...d.pts] });
    } else if (d.kind === "eraser") eraseAt(p.x, p.y);
    else if (d.kind === "shape") {
      const end = lineEnd(d.x0, d.y0, p.x, p.y, e.shiftKey);
      setDraft({ kind: "shape", r: shapeRect(d.x0, d.y0, p.x, p.y, e.shiftKey), line: [d.x0, d.y0, end.x, end.y] });
    }
  }

  function onUp(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "pinch") {
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    drag.current = null;
    if (!d) return;
    const p = world(e.clientX, e.clientY);
    if (d.kind === "move" && d.moved) {
      const ops: MoodOp[] = [];
      const cur = boardsRef.current[active];
      for (const id of Object.keys(d.groups)) {
        const g = cur.groups.find((x) => x.id === id);
        if (g && preview[id]) ops.push({ t: "patch", c: "groups", id, set: { x: preview[id].x, y: preview[id].y } });
      }
      for (const id of Object.keys(d.nodes)) {
        const n = current(id);
        if (n && preview[id]) ops.push({ t: "patch", c: "nodes", id, set: { x: preview[id].x, y: preview[id].y } });
      }
      // Elemen yang digeser dibawa ke depan, kecuali saat yang digeser kelompok (urutan isinya tetap).
      if (!Object.keys(d.groups).length) for (const id of Object.keys(d.nodes)) ops.push({ t: "front", id });
      commit(ops);
    } else if (d.kind === "resize" && preview[d.id]) {
      const r = preview[d.id];
      if (d.coll === "groups") patchGroup(d.id, { x: r.x, y: r.y, w: r.w, h: r.h });
      else patchNode(d.id, current(d.id)?.type === "text" ? { x: r.x, w: r.w } : { x: r.x, y: r.y, w: r.w, h: r.h });
    } else if (d.kind === "link") {
      const hit = [...b.nodes].reverse().find((n) => {
        if (isStroke(n) || n.hidden) return false;
        const r = box(n);
        return p.x >= r.x - 10 && p.x <= r.x + r.w + 10 && p.y >= r.y - 10 && p.y <= r.y + r.h + 10;
      });
      if (hit && hit.id !== d.from) connect(d.from, hit.id);
    } else if (d.kind === "pen") finishPen(d.pts);
    else if (d.kind === "eraser" && erasing.length) {
      commit(erasing.map((id) => ({ t: "del", c: "nodes", id })));
      setErasing([]);
    } else if (d.kind === "shape") finishShape(d.x0, d.y0, p.x, p.y, e.shiftKey);
    setPreview({});
    setDraft(null);
    presence({ board: active, moving: null });
  }

  function finishPen(pts: number[]) {
    if (raw.nodes.length >= MOOD_LIMITS.nodes) return flash(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
    // Ketukan tanpa gerak jadi titik.
    const line = pts.length === 2 ? [...pts, pts[0] + 0.1, pts[1]] : simplify(pts, 1 / zoom);
    const l = toLocal(line.slice(0, MOOD_LIMITS.points), style.strokeWidth / 2 + 2);
    commit([{ t: "put", c: "nodes", item: { id: uid(), type: "draw", title: "", tags: [], color: style.color, strokeWidth: style.strokeWidth, ...l } }]);
  }

  function finishShape(x0: number, y0: number, x1: number, y1: number, shift: boolean) {
    const line = shapeKind === "line" || shapeKind === "arrow";
    // Klik tanpa menyeret: bentuk ukuran bawaan di titik itu.
    const tiny = Math.hypot(x1 - x0, y1 - y0) * zoom < 6;
    let item: Omit<MoodNode, "id" | "tags">;
    if (line) {
      const end = tiny ? { x: x0 + 160, y: y0 } : lineEnd(x0, y0, x1, y1, shift);
      const l = toLocal([x0, y0, end.x, end.y], style.strokeWidth * 2 + 4);
      item = { type: "shape", shape: shapeKind, title: "", color: style.color, strokeWidth: style.strokeWidth, ...l };
    } else {
      const r = tiny ? { x: x0, y: y0, w: 160, h: shapeKind === "ellipse" ? 160 : 120 } : shapeRect(x0, y0, x1, y1, shift);
      item = { type: "shape", shape: shapeKind, title: "", color: style.color, strokeWidth: style.strokeWidth, fill: style.fill, x: r1(r.x), y: r1(r.y), w: Math.max(8, r1(r.w)), h: Math.max(8, r1(r.h)) };
    }
    if (addNode(item, { x: item.x, y: item.y })) setTool("select");
  }

  function onWheel(e: WheelEvent) {
    const p = world(e.clientX, e.clientY);
    setFollowing(null);
    if (e.ctrlKey || e.metaKey) zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 0.9), p.sx, p.sy);
    else setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
  }

  /* ---------- Keyboard ---------- */

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (t.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) {
      if (k === "Escape" && editing && t.tagName === "TEXTAREA") {
        setEditing(null);
        boardRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    // Spasi, panah, dan Delete hanya untuk kanvas: di tombol toolbar atau panel tombol itu tetap bekerja seperti biasa.
    const onCanvas = t === document.body || !!boardRef.current?.contains(t);
    if (mod && (k === "z" || k === "Z")) {
      e.preventDefault();
      return undo(e.shiftKey ? "redo" : "undo");
    }
    if (mod && (k === "y" || k === "Y")) {
      e.preventDefault();
      return undo("redo");
    }
    if (mod && (k === "d" || k === "D")) {
      e.preventDefault();
      return duplicateSelection();
    }
    if (mod && (k === "g" || k === "G")) {
      e.preventDefault();
      if (e.shiftKey) return ungroup(sel?.kind === "group" ? sel.ids : []);
      return groupSelection();
    }
    // Shift mengubah ] dan [ menjadi } dan { di keyboard US.
    if (mod && "[]{}".includes(k) && k.length === 1 && sel?.kind === "node") {
      e.preventDefault();
      const up = k === "]" || k === "}";
      return restack(up ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
    }
    if (mod && (k === "a" || k === "A") && onCanvas) {
      e.preventDefault();
      const all = b.nodes.filter(pickable).map((n) => n.id);
      return setSel(all.length ? { kind: "node", ids: all } : null);
    }
    if (mod || e.altKey) return;
    const stepPx = e.shiftKey ? 1 : 10;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-stepPx, 0], ArrowRight: [stepPx, 0], ArrowUp: [0, -stepPx], ArrowDown: [0, stepPx] };
    if (k === "Escape") {
      setSel(null);
      setTool("select");
      setFollowing(null);
      drag.current = null;
      setDraft(null);
      setPreview({});
    } else if (!onCanvas) {
      return;
    } else if ((k === "Delete" || k === "Backspace") && sel) {
      e.preventDefault();
      removeSelection();
    } else if (k === " ") {
      e.preventDefault();
      setSpaceDown(true);
    } else if (arrows[k] && sel && sel.kind !== "edge") {
      e.preventDefault();
      const [dx, dy] = arrows[k];
      const d = boardsRef.current[active];
      const ops: MoodOp[] = [];
      const moved = new Set<string>();
      for (const id of sel.ids) {
        const g = d.groups.find((x) => x.id === id);
        if (g) {
          ops.push({ t: "patch", c: "groups", id: g.id, set: { x: g.x + dx, y: g.y + dy } });
          for (const n of d.nodes) if (insideRect(box(n), g)) moved.add(n.id);
        } else moved.add(id);
      }
      for (const id of moved) {
        const n = d.nodes.find((x) => x.id === id);
        if (n && !n.locked) ops.push({ t: "patch", c: "nodes", id, set: { x: n.x + dx, y: n.y + dy } });
      }
      commit(ops, `nudge:${sel.ids.join()}`);
    } else {
      const tools: Record<string, Tool> = { v: "select", h: "hand", c: "link", p: "pen", e: "eraser", r: "shape", t: "text" };
      const next = tools[k.toLowerCase()];
      if (next) setTool(next);
      else if (k === "+" || k === "=") zoomStep(0.1);
      else if (k === "-") zoomStep(-0.1);
    }
  }
  // Pintasan didengar di jendela supaya tetap jalan setelah menekan tombol di toolbar atau panel.
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => keyRef.current(e);
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Tempel (Ctrl+V) di kanvas: link jadi kartu media, gambar dari clipboard jadi foto.
  const pasteRef = useRef<(e: ClipboardEvent) => void>(() => {});
  useEffect(() => {
    pasteRef.current = (e) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      const text = e.clipboardData?.getData("text/plain").trim() ?? "";
      if (files.length) {
        e.preventDefault();
        addPhotos(files);
      } else if (isLink(text)) {
        e.preventDefault();
        void importLink(text);
      }
    };
  });
  useEffect(() => {
    const paste = (e: ClipboardEvent) => pasteRef.current(e);
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, []);

  /* ---------- Teks: ukur tinggi, isian langsung di kanvas ---------- */

  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    observer.current ??= new ResizeObserver((entries) =>
      setTextH((prev) => {
        let next = prev;
        for (const en of entries) {
          const el2 = en.target as HTMLElement;
          const nid = el2.dataset.id!;
          if (Math.abs((prev[nid] ?? 0) - el2.offsetHeight) > 1) next = { ...next, [nid]: el2.offsetHeight };
        }
        return next;
      }),
    );
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);

  // Teks kosong yang ditinggalkan dihapus, supaya tidak ada elemen tak terlihat di papan.
  const prevEditing = useRef<string | null>(null);
  useEffect(() => {
    const was = prevEditing.current;
    prevEditing.current = editing;
    if (!was || was === editing) return;
    const n = current(was);
    if (n?.type === "text" && !n.text?.trim()) {
      commit([{ t: "del", c: "nodes", id: was }]);
      setSel((s) => (s?.ids.includes(was) ? null : s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* ---------- Bagikan ---------- */

  async function toggleShare(enabled: boolean) {
    setSharing(true);
    const r = await setMoodboardShare(active, enabled);
    setSharing(false);
    if (!r.ok) return flash(r.error);
    setShare((s) => ({ ...s, [active]: r.token ?? null }));
  }

  /* ---------- Render ---------- */

  const isEmpty = b.nodes.length === 0 && b.groups.length === 0 && !ghosts.length && !importGhosts.length;
  const grid = 20 * zoom;
  const st = sync.state;
  const cursor =
    spaceDown || tool === "hand" ? "cursor-grab active:cursor-grabbing" : tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair";
  // Ada anggota lain di papan ini: kursor sendiri ikut berwarna, sama seperti yang mereka lihat.
  const ownCursor = peers.length > 0 && tool === "select" && !spaceDown ? cursorCss(presenceColor(me.id)) : undefined;
  const linkFrom = draft?.kind === "link" ? byId.get(draft.from) : undefined;
  const linkD = draft?.kind === "link" && linkFrom ? curve(box(linkFrom), { x: draft.x, y: draft.y, w: 0, h: 0 }).d : "";
  const toolHint =
    tool === "link"
      ? linkD
        ? "Lepas di atas elemen lain untuk menyambung"
        : "Mode sambung: tekan sebuah kartu, lalu tarik ke kartu lain"
      : tool === "eraser"
        ? "Seret di atas goresan pena untuk menghapusnya"
        : tool === "text"
          ? "Klik di kanvas untuk menulis"
          : tool === "shape"
            ? "Seret untuk menggambar. Tahan Shift untuk persegi, lingkaran, atau garis lurus 45°"
            : null;
  const shareUrl = share[active] && typeof window !== "undefined" ? `${window.location.origin}/m/${share[active]}` : "";

  return (
    // touch-manipulation: ketuk dua kali di toolbar atau panel tidak memperbesar halaman di iPad.
    <div className="flex h-full min-h-0 touch-manipulation flex-col overflow-hidden rounded-[22px] bg-surface">
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
        <button
          type="button"
          aria-pressed={layersOpen}
          aria-label="Panel Layer"
          title={layersOpen ? "Sembunyikan panel Layer" : "Tampilkan panel Layer"}
          onClick={() => setLayersOpen((o) => !o)}
          className={cx("flex size-11 items-center justify-center rounded-xl transition-colors duration-150", layersOpen ? "bg-ground" : "hover:bg-ground")}
        >
          <PanelLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">Moodboard</h1>
        <div role="group" aria-label="Papan" className="flex gap-1 rounded-xl bg-ground p-1">
          {MOOD_BOARDS.map((x) => {
            const here = peersAll.filter((p) => p.board === x.id);
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={active === x.id}
                onClick={() => {
                  setFollowing(null);
                  pickBoard(x.id);
                }}
                className={cx(
                  "flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold transition-colors duration-150",
                  active === x.id ? "bg-ink text-white" : "text-ink hover:bg-surface",
                )}
              >
                {x.name}
                {/* Titik warna anggota yang sedang membuka papan lain. */}
                {here.length > 0 && active !== x.id && (
                  <span className="flex -space-x-1" aria-hidden="true">
                    {here.slice(0, 3).map((p) => (
                      <span key={p.clientId} className="size-2.5 rounded-full ring-2 ring-ground" style={{ background: p.color }} />
                    ))}
                  </span>
                )}
                <span className="hidden text-[11px] font-medium opacity-80 min-[1440px]:inline">{boards[x.id].nodes.length} elemen</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <PeerAvatars peers={peersAll} following={following} onFollow={setFollowing} />
        <p role="status" className={cx("text-[12px] font-semibold", st === "error" || st === "offline" ? "text-warn-fg" : "text-muted")}>
          {SAVE_TEXT[st]}
        </p>
        <div role="group" aria-label="Riwayat" className="flex gap-0.5 rounded-xl bg-ground p-1">
          <button
            type="button"
            aria-label="Batalkan (Ctrl+Z)"
            title="Batalkan (Ctrl+Z)"
            disabled={!hist.undo}
            onClick={() => undo("undo")}
            className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface disabled:text-[#8d8c9e] disabled:hover:bg-transparent"
          >
            <Undo2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ulangi (Ctrl+Shift+Z)"
            title="Ulangi (Ctrl+Shift+Z)"
            disabled={!hist.redo}
            onClick={() => undo("redo")}
            className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface disabled:text-[#8d8c9e] disabled:hover:bg-transparent"
          >
            <Redo2 size={17} aria-hidden="true" />
          </button>
        </div>
        <div role="group" aria-label="Zoom" className="flex items-center gap-0.5 rounded-xl bg-ground p-1">
          <button type="button" aria-label="Perkecil" onClick={() => zoomStep(-0.1)} className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface">
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className="min-w-11 text-center text-[12px] font-bold tabular">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Perbesar" onClick={() => zoomStep(0.1)} className="flex size-10 items-center justify-center rounded-[10px] hover:bg-surface">
            <Plus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFollowing(null);
              fit();
            }}
            className="h-10 rounded-[10px] bg-surface px-3 text-[12px] font-bold"
          >
            Paskan
          </button>
        </div>
        <button type="button" onClick={() => setShareOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline px-3.5 text-[13px] font-bold hover:bg-sunken">
          <Share2 size={16} aria-hidden="true" />
          Bagikan
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {layersOpen && (
          <aside aria-label="Layer" className="flex w-[240px] shrink-0 flex-col border-r border-line">
            <div className="flex min-h-14 items-center justify-between gap-2 border-b border-line pl-4 pr-2">
              <h2 className="text-[14px] font-extrabold">Layer</h2>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  aria-label="Kelompokkan pilihan (Ctrl+G)"
                  title="Kelompokkan pilihan (Ctrl+G)"
                  disabled={sel?.kind !== "node"}
                  onClick={groupSelection}
                  className="flex size-10 items-center justify-center rounded-lg hover:bg-ground disabled:text-[#8d8c9e] disabled:hover:bg-transparent"
                >
                  <Group size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Lepas kelompok (Ctrl+Shift+G)"
                  title="Lepas kelompok (Ctrl+Shift+G)"
                  disabled={sel?.kind !== "group"}
                  onClick={() => ungroup(sel?.kind === "group" ? sel.ids : [])}
                  className="flex size-10 items-center justify-center rounded-lg hover:bg-ground disabled:text-[#8d8c9e] disabled:hover:bg-transparent"
                >
                  <Ungroup size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <LayersPanel
                data={b}
                sel={sel}
                owners={owners}
                label={nodeLabel}
                actions={{
                  select: selectLayer,
                  rename: (kind, id, title) => (kind === "node" ? patchNode(id, { title }) : patchGroup(id, { title })),
                  toggle: toggleLayer,
                  reorder: reorderLayer,
                }}
              />
            </div>
            <p className="border-t border-line px-4 py-3 text-[12px] leading-[1.5] text-muted">
              Seret untuk mengubah urutan, klik dua kali untuk mengganti nama. Isi kelompok mengikuti posisinya di kanvas.
            </p>
          </aside>
        )}

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
          onPointerLeave={() => presence({ board: active, cursor: null })}
          onWheel={onWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const p = world(e.clientX, e.clientY);
            // Link yang diseret dari tab browser lain jadi kartu media.
            const link = (e.dataTransfer.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#")) ?? e.dataTransfer.getData("text/plain")).trim();
            if (!e.dataTransfer.files.length && isLink(link)) return void importLink(link, { x: r1(p.x - 130), y: r1(p.y - 150) });
            addPhotos(e.dataTransfer.files, { x: r1(p.x - 120), y: r1(p.y - 100) });
          }}
          className={cx(
            "relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-ground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
            cursor,
          )}
          // Titik grid ikut bergeser dan membesar bersama kanvas: penanda bahwa area ini bisa digeser dan di-zoom.
          style={{
            backgroundImage: "radial-gradient(#cfced9 1px, transparent 1.3px)",
            backgroundSize: `${grid}px ${grid}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: ownCursor,
          }}
        >
          <div className="absolute left-0 top-0 size-px origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {b.groups.filter((g) => !g.hidden).map((g) => {
              const c = MOOD_GROUP_COLORS[g.color] ?? MOOD_GROUP_COLORS.netral;
              const on = selGroup?.id === g.id;
              return (
                <div
                  key={g.id}
                  onPointerDown={(e) => onGroupDown(e, g)}
                  className={cx("absolute box-border rounded-[20px]", tool === "select" && "cursor-move")}
                  style={{ left: g.x, top: g.y, width: g.w, height: g.h, background: c.bg, border: on ? "2px solid #1c1b29" : `1.5px solid ${c.line}` }}
                >
                  <div className="absolute inset-x-4 top-3 flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[14px] font-extrabold">{g.title || "Kelompok"}</span>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-muted">{b.nodes.filter((n) => insideRect(box(n), g)).length} elemen</span>
                  </div>
                  {on && !g.locked && <Handles zoom={zoom} corners={["se"]} onDown={(e, c2) => onResizeDown(e, g.id, "groups", c2)} />}
                </div>
              );
            })}

            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
              {b.edges.map((ed) => {
                const A = byId.get(ed.from);
                const B = byId.get(ed.to);
                if (!A || !B || !shownIds.has(A.id) || !shownIds.has(B.id)) return null;
                const { d } = curve(box(A), box(B));
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
                        if (tool !== "select" && tool !== "link") return;
                        e.stopPropagation();
                        setSel({ kind: "edge", ids: [ed.id] });
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
              if (!A || !B || !ed.label || !shownIds.has(A.id) || !shownIds.has(B.id)) return null;
              return (
                <EdgeLabel
                  key={ed.id}
                  e={ed}
                  at={curve(box(A), box(B))}
                  selected={selEdge?.id === ed.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSel({ kind: "edge", ids: [ed.id] });
                  }}
                />
              );
            })}

            {shownNodes.map((n) => {
              const r = box(n);
              const on = sel?.kind === "node" && selIds.includes(n.id);
              const single = on && selIds.length === 1;
              const card = isCard(n);
              const stroke = isStroke(n);
              const linkable = !stroke && !n.locked && (tool === "select" || tool === "link");
              const showHandles = single || tool === "link";
              const resizable = single && !n.locked && n.type !== "palette" && editing !== n.id && tool === "select";
              return (
                <div
                  key={n.id}
                  ref={n.type === "text" ? measure : undefined}
                  data-id={n.id}
                  onPointerDown={stroke ? undefined : (e) => onNodeDown(e, n)}
                  className={cx(
                    "group/node absolute box-border",
                    stroke && "pointer-events-none",
                    tool === "select" && !stroke && !n.locked && editing !== n.id && "cursor-move",
                    tool === "link" && "cursor-crosshair",
                    card && "rounded-[18px] border-2",
                    card && (n.type === "note" ? "bg-note-bg" : "bg-surface"),
                    card && (on ? "border-ink" : n.type === "note" ? "border-[#ebddba]" : "border-line"),
                    !card && on && "outline-2 outline-offset-4 outline-ink",
                  )}
                  style={{ left: n.x, top: n.y, width: r.w, height: n.type === "text" ? undefined : r.h }}
                >
                  {linkable &&
                    (["right", "left", "top", "bottom"] as const).map((side) => (
                      <span
                        key={side}
                        aria-hidden="true"
                        data-link-handle=""
                        className={cx(
                          "absolute z-[2] size-[18px] cursor-crosshair rounded-full border-2 border-ink bg-surface transition-opacity duration-150 hover:bg-ink",
                          showHandles ? "opacity-100" : "opacity-0 group-hover/node:opacity-100",
                          // Kartu: titik di tepi. Teks dan bentuk: titik di luar garis pilihan, dan hanya saat dipilih supaya tidak mengganggu.
                          side === "right" && (card ? "-right-[10px]" : "-right-[24px]"),
                          side === "left" && (card ? "-left-[10px]" : "-left-[24px]"),
                          side === "top" && (card ? "-top-[10px]" : "-top-[24px]"),
                          side === "bottom" && (card ? "-bottom-[10px]" : "-bottom-[24px]"),
                          (side === "right" || side === "left") && "top-1/2 -mt-[9px]",
                          (side === "top" || side === "bottom") && "left-1/2 -ml-[9px]",
                          !card && !showHandles && "hidden",
                        )}
                      />
                    ))}
                  {n.type === "photo" && <PhotoCard n={n} src={photoSrc(n)} uploading={!!uploads[n.id]} showOpen={single} onOpen={() => setViewer(n.id)} />}
                  {n.type === "media" && <MediaCard n={n} src={mediaSrc} swipe={single && tool === "select"} showOpen={single} onOpen={() => setViewer(n.id)} />}
                  {n.type === "note" && <NoteCard n={n} />}
                  {n.type === "palette" && <PaletteCard n={n} />}
                  {n.type === "text" &&
                    (editing === n.id ? (
                      <textarea
                        autoFocus
                        aria-label="Isi teks"
                        data-canvas-text=""
                        value={n.text ?? ""}
                        maxLength={MOOD_LIMITS.text}
                        placeholder="Ketik teks"
                        onChange={(e) => patchNode(n.id, { text: e.target.value }, `text:${n.id}`)}
                        onPointerDown={(e) => e.stopPropagation()}
                        // Pindah tab atau jendela juga memicu blur: isian tetap terbuka sampai kembali.
                        onBlur={() => document.hasFocus() && setEditing((x) => (x === n.id ? null : x))}
                        ref={(el) => {
                          if (!el) return;
                          el.style.height = "auto";
                          el.style.height = `${el.scrollHeight}px`;
                        }}
                        rows={1}
                        className="block w-full resize-none overflow-hidden bg-transparent p-0 placeholder:text-muted focus-visible:outline-none"
                        style={textStyle(n)}
                      />
                    ) : (
                      <TextBody n={n} />
                    ))}
                  {(n.type === "shape" || n.type === "draw") && (
                    <StrokeBody n={n} w={r.w} h={r.h} faded={erasing.includes(n.id)} onHitDown={stroke ? (e) => onNodeDown(e, n) : undefined} />
                  )}
                  {resizable && (
                    <Handles zoom={zoom} corners={n.type === "text" ? ["ne", "se"] : ["nw", "ne", "sw", "se"]} inset={card ? -2 : -6} onDown={(e, c2) => onResizeDown(e, n.id, "nodes", c2)} />
                  )}
                </div>
              );
            })}

            {ghosts.map((u) => (
              <div
                key={u.node.id}
                className="pointer-events-none absolute box-border rounded-[18px] border-2 border-line bg-surface"
                style={{ left: u.node.x, top: u.node.y, width: 240, height: 222 }}
              >
                <PhotoCard n={u.node} src={u.url} uploading showOpen={false} onOpen={() => {}} />
              </div>
            ))}

            {importGhosts.map(([id, p]) => (
              <div
                key={id}
                className="pointer-events-none absolute box-border flex flex-col overflow-hidden rounded-[18px] border-2 border-line bg-surface"
                style={{ left: p.x, top: p.y, width: MEDIA_W.portrait, height: 312 }}
              >
                <div className="flex-1 bg-[#e8e7ef]" />
                <div className="flex items-center px-3 text-[12px] font-semibold text-muted" style={{ height: MEDIA_FOOTER }}>
                  Mengambil dari {p.source}…
                </div>
              </div>
            ))}

            {/* Gambar yang sedang dibuat */}
            {draft?.kind === "pen" && (
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
                <polyline points={draft.pts.join(" ")} fill="none" stroke={style.color} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {draft?.kind === "shape" && (
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
                {shapeKind === "line" || shapeKind === "arrow" ? (
                  <line x1={draft.line[0]} y1={draft.line[1]} x2={draft.line[2]} y2={draft.line[3]} stroke={style.color} strokeWidth={style.strokeWidth} strokeLinecap="round" />
                ) : shapeKind === "ellipse" ? (
                  <ellipse
                    cx={draft.r.x + draft.r.w / 2}
                    cy={draft.r.y + draft.r.h / 2}
                    rx={draft.r.w / 2}
                    ry={draft.r.h / 2}
                    fill={style.fill ?? "none"}
                    stroke={style.color}
                    strokeWidth={style.strokeWidth}
                  />
                ) : (
                  <rect
                    x={draft.r.x}
                    y={draft.r.y}
                    width={draft.r.w}
                    height={draft.r.h}
                    rx={Math.min(14, draft.r.w / 4, draft.r.h / 4)}
                    fill={style.fill ?? "none"}
                    stroke={style.color}
                    strokeWidth={style.strokeWidth}
                  />
                )}
              </svg>
            )}
            {draft?.kind === "marquee" && (
              <div
                className="pointer-events-none absolute rounded-[4px] border-solid border-ink bg-ink/5"
                style={{ left: draft.r.x, top: draft.r.y, width: draft.r.w, height: draft.r.h, borderWidth: 1 / zoom }}
              />
            )}
          </div>

          <PeerSelections peers={peers} box={boxById} view={{ pan, zoom }} />
          <Cursors peers={peers} view={{ pan, zoom }} />

          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto flex max-w-[380px] flex-col items-start gap-2 rounded-[20px] border-[1.5px] border-dashed border-outline bg-surface px-7 py-6">
                <p className="text-[16px] font-extrabold">Papan {boardName} masih kosong</p>
                <p className="text-[13px] leading-[1.5] text-muted">
                  Seret foto referensi dari komputer ke sini, atau tempel link Instagram dan Pinterest dengan Ctrl+V. Mau mulai dari kerangka? Buat kelompok Dekor, Busana, dan Warna lalu isi satu per satu.
                </p>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={starterGroups}
                  className="mt-1 inline-flex h-11 items-center rounded-xl bg-ground px-4 text-[13px] font-bold hover:bg-[#e8e7ef]"
                >
                  Buat kelompok awal
                </button>
              </div>
            </div>
          )}

          {followed && <div className="pointer-events-none absolute inset-0 border-[3px]" style={{ borderColor: followed.color }} aria-hidden="true" />}

          {/* Alat di bawah, seperti Figma. Petunjuk dan pengaturan alat bertumpuk di atasnya. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-2">
            {followed ? (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto flex items-center gap-2 rounded-xl py-1 pl-3.5 pr-1 text-[13px] font-semibold text-white"
                style={{ background: followed.color }}
              >
                Mengikuti {firstName(followed.name)}
                <button type="button" onClick={() => setFollowing(null)} className="h-9 rounded-lg bg-white/20 px-3 text-[12px] font-bold hover:bg-white/30">
                  Berhenti
                </button>
              </div>
            ) : (
              toolHint && <p className="max-w-full rounded-xl bg-ink px-3.5 py-2.5 text-center text-[13px] font-semibold text-white">{toolHint}</p>
            )}
            {(tool === "pen" || tool === "shape" || tool === "text") && (
              <ToolOptions tool={tool} closedShape={shapeKind === "rect" || shapeKind === "ellipse"} style={style} onChange={(s) => setStyle((x) => ({ ...x, ...s }))} />
            )}
            <div
              role="toolbar"
              aria-label="Alat moodboard"
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-bar [scrollbar-width:none]"
            >
              <ToolButton label="Pilih" hint="Pilih dan geser (V)" on={tool === "select"} onClick={() => setTool("select")} icon={<MousePointer2 size={18} aria-hidden="true" />} />
              <ToolButton label="Tangan" hint="Geser kanvas (H, atau tahan Spasi)" on={tool === "hand"} onClick={() => setTool("hand")} icon={<Hand size={18} aria-hidden="true" />} />
              <ToolButton label="Sambung" hint="Sambung kartu (C)" on={tool === "link"} onClick={() => setTool("link")} icon={<Spline size={18} aria-hidden="true" />} />
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
              <ToolButton label="Pena" hint="Gambar bebas (P)" on={tool === "pen"} onClick={() => setTool("pen")} icon={<PenLine size={18} aria-hidden="true" />} />
              <ToolButton label="Hapus" hint="Penghapus goresan pena (E)" on={tool === "eraser"} onClick={() => setTool("eraser")} icon={<Eraser size={18} aria-hidden="true" />} />
              <Popover>
                <PopoverTrigger
                  title="Bentuk (R)"
                  aria-pressed={tool === "shape"}
                  aria-label={`Bentuk (R), sekarang ${SHAPES.find((s) => s.k === shapeKind)!.name}`}
                  onClick={() => setTool("shape")}
                  className={cx(TOOL_CLASS, tool === "shape" ? "bg-accent text-ink" : "hover:bg-ground")}
                >
                  {SHAPES.find((s) => s.k === shapeKind)!.icon}
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="flex w-auto flex-col gap-1 p-1.5">
                  {SHAPES.map((s) => (
                    <button
                      key={s.k}
                      type="button"
                      aria-pressed={shapeKind === s.k}
                      onClick={() => {
                        setShapeKind(s.k);
                        setTool("shape");
                      }}
                      className={cx("flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13px] font-bold", shapeKind === s.k ? "bg-ground" : "hover:bg-sunken")}
                    >
                      {s.icon}
                      {s.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <ToolButton label="Teks" hint="Tulis teks (T)" on={tool === "text"} onClick={() => setTool("text")} icon={<Type size={18} aria-hidden="true" />} />
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
              <label title="Unggah foto" className={cx(TOOL_CLASS, "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-ground")}>
                <ImageIcon size={18} aria-hidden="true" />
                <input
                  type="file"
                  accept={PHOTO_MIME.join(",")}
                  multiple
                  aria-label="Unggah foto"
                  className="sr-only"
                  onChange={(e) => {
                    addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                <PopoverTrigger
                  title="Tambah dari link"
                  aria-label="Tambah dari link Instagram, Pinterest, atau situs lain"
                  className={cx(TOOL_CLASS, linkOpen ? "bg-accent text-ink" : "hover:bg-ground")}
                >
                  <Link2 size={18} aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-[320px] p-3">
                  <form
                    className="flex flex-col gap-2.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const u = linkUrl.trim();
                      if (!isLink(u)) return flash("Itu bukan link. Salin alamat lengkap yang diawali https://.");
                      void importLink(u);
                      setLinkUrl("");
                      setLinkOpen(false);
                    }}
                  >
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-muted">Link foto atau video</span>
                      <Input autoFocus type="url" inputMode="url" value={linkUrl} placeholder="https://www.instagram.com/p/…" onChange={(e) => setLinkUrl(e.target.value)} />
                    </label>
                    <p className="text-[12px] leading-[1.5] text-muted">
                      Postingan Instagram, Pin Pinterest, atau halaman lain. Carousel jadi satu kartu, video bisa diputar. Bisa juga langsung Ctrl+V di kanvas.
                    </p>
                    <button type="submit" disabled={!linkUrl.trim()} className="h-11 rounded-xl bg-ink text-[13px] font-bold text-white hover:bg-[#2e2d40] disabled:opacity-60">
                      Tambahkan ke papan
                    </button>
                  </form>
                </PopoverContent>
              </Popover>
              <ToolButton label="Catatan" hint="Tambah catatan" onClick={() => addNode({ type: "note", title: "Catatan baru", text: "" })} icon={<NotebookPen size={18} aria-hidden="true" />} />
              <ToolButton
                label="Warna"
                hint="Tambah palet warna"
                onClick={() => addNode({ type: "palette", title: "Palet baru", swatches: ["#f4f1ea", "#d9d8e4", "#7c8b6a"] })}
                icon={<Palette size={18} aria-hidden="true" />}
              />
              <ToolButton label="Kelompok" hint="Tambah kelompok kosong, misalnya Pelaminan atau Busana" onClick={addGroup} icon={<SquareDashed size={18} aria-hidden="true" />} />
            </div>
          </div>
          {notice && (
            <p role="alert" className="absolute right-3 top-3 max-w-[320px] rounded-xl bg-warn-bg px-3.5 py-2.5 text-[13px] font-semibold text-warn-fg">
              {notice}
            </p>
          )}
        </div>

        {/* Panel properti: semua pengaturan elemen yang dipilih. */}
        <aside aria-label="Properti" className="flex w-[272px] shrink-0 flex-col overflow-y-auto border-l border-line *:shrink-0 min-[1200px]:w-[296px]">
          {selNodes.length > 1 ? (
            <>
              <PanelHead label={`${selNodes.length} elemen dipilih`} onDone={() => setSel(null)} />
              <Section title="Ratakan">
                <div role="group" aria-label="Ratakan" className="flex gap-0.5 rounded-xl bg-ground p-1">
                  <IconAction label="Rata kiri" onClick={() => alignSelected("left")}>
                    <AlignStartVertical size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Rata tengah mendatar" onClick={() => alignSelected("hcenter")}>
                    <AlignCenterVertical size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Rata kanan" onClick={() => alignSelected("right")}>
                    <AlignEndVertical size={17} aria-hidden="true" />
                  </IconAction>
                  <span className="mx-0.5 my-2 w-px shrink-0 bg-line" aria-hidden="true" />
                  <IconAction label="Rata atas" onClick={() => alignSelected("top")}>
                    <AlignStartHorizontal size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Rata tengah tegak" onClick={() => alignSelected("vcenter")}>
                    <AlignCenterHorizontal size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Rata bawah" onClick={() => alignSelected("bottom")}>
                    <AlignEndHorizontal size={17} aria-hidden="true" />
                  </IconAction>
                </div>
              </Section>
              {selNodes.every((n) => n.color !== undefined) && (
                <Section title="Warna semua">
                  <ColorField label="Warna semua elemen" value={selNodes[0].color ?? "#1c1b29"} swatches={boardColors} onChange={(color) => patchSelected({ color }, `color:${selIds.join()}`)} />
                </Section>
              )}
              <Section title="Susun">
                <div role="group" aria-label="Urutan lapisan" className="flex gap-0.5 rounded-xl bg-ground p-1">
                  <IconAction label="Paling depan (Ctrl+Shift+])" onClick={() => restack("front")}>
                    <ChevronsUp size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Maju satu (Ctrl+])" onClick={() => restack("forward")}>
                    <ArrowUp size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Mundur satu (Ctrl+[)" onClick={() => restack("backward")}>
                    <ArrowDown size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Paling belakang (Ctrl+Shift+[)" onClick={() => restack("back")}>
                    <ChevronsDown size={17} aria-hidden="true" />
                  </IconAction>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={groupSelection} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]">
                    <Group size={16} aria-hidden="true" />
                    Kelompokkan
                  </button>
                  <button type="button" onClick={duplicateSelection} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]">
                    <Copy size={16} aria-hidden="true" />
                    Duplikat
                  </button>
                </div>
                <p className="text-[12px] leading-[1.5] text-muted">Geser salah satu untuk memindahkan semuanya. Shift dan klik untuk menambah atau mengurangi pilihan.</p>
              </Section>
              <Section>
                <DangerButton onClick={removeSelection}>Hapus {selNodes.length} elemen</DangerButton>
              </Section>
            </>
          ) : selNode ? (
            <>
              <PanelHead label={PANEL_LABEL[selNode.type]} onDone={() => setSel(null)} />
              {isCard(selNode) && (
                <Section>
                  <TextField label="Judul" value={selNode.title} max={120} onChange={(v) => patchNode(selNode.id, { title: v }, `title:${selNode.id}`)} />
                </Section>
              )}
              <Section title="Posisi dan ukuran">
                <GeometryFields
                  r={box(selNode)}
                  lockH={selNode.type === "text" || selNode.type === "media"}
                  lockWH={selNode.type === "palette"}
                  onChange={(p) => setGeometry(selNode, p)}
                />
                {selNode.locked && (
                  <p className="text-[12px] leading-[1.5] text-muted">
                    Terkunci, jadi tidak bisa dipilih atau digeser di kanvas.{" "}
                    <button type="button" onClick={() => toggleLayer("node", selNode.id, "locked")} className="hit-44 font-bold text-ink underline underline-offset-2">
                      Buka kunci
                    </button>
                  </p>
                )}
              </Section>
              {selNode.type === "text" && (
                <Section title="Teks">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-muted">Isi teks</span>
                    <Textarea
                      rows={3}
                      maxLength={MOOD_LIMITS.text}
                      value={selNode.text ?? ""}
                      onChange={(e) => patchNode(selNode.id, { text: e.target.value }, `text:${selNode.id}`)}
                      className="resize-y leading-[1.5]"
                    />
                  </label>
                  <TextPanel n={selNode} colors={boardColors} onChange={(p) => patchNode(selNode.id, p, `style:${selNode.id}:${Object.keys(p).join()}`)} />
                </Section>
              )}
              {(selNode.type === "shape" || selNode.type === "draw") && (
                <Section title={selNode.type === "draw" ? "Tinta" : "Garis dan isi"}>
                  <StrokePanel n={selNode} colors={boardColors} onChange={(p) => patchNode(selNode.id, p, `style:${selNode.id}:${Object.keys(p).join()}`)} />
                </Section>
              )}
              {selNode.type === "note" && (
                <Section title="Isi catatan">
                  <Textarea
                    aria-label="Isi catatan"
                    rows={5}
                    maxLength={2000}
                    value={selNode.text ?? ""}
                    placeholder="Tulis ide atau pertanyaan, misalnya untuk MUA atau dekorator."
                    onChange={(e) => patchNode(selNode.id, { text: e.target.value }, `text:${selNode.id}`)}
                    className="resize-y leading-[1.5]"
                  />
                </Section>
              )}
              {selNode.type === "photo" && (
                <Section title="Foto">
                  {photoSrc(selNode) && (
                    <PhotoAdjust n={selNode} src={photoSrc(selNode)!} onChange={(patch) => patchNode(selNode.id, patch, `photo:${selNode.id}`)} onOpen={() => setViewer(selNode.id)} />
                  )}
                  <label className="relative flex h-11 cursor-pointer items-center justify-center rounded-xl border border-outline text-[13px] font-bold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink hover:bg-sunken">
                    {uploads[selNode.id] ? "Mengunggah…" : "Ganti foto"}
                    <input
                      type="file"
                      accept={PHOTO_MIME.join(",")}
                      disabled={!!uploads[selNode.id]}
                      className="sr-only"
                      onChange={(e) => {
                        replacePhoto(selNode.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Section>
              )}
              {selNode.type === "media" && selNode.url && (
                <Section title="Sumber">
                  <a
                    href={selNode.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 min-w-0 items-center gap-2 rounded-xl border border-outline px-3 text-[13px] font-bold no-underline hover:bg-sunken"
                  >
                    <ExternalLink size={16} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Buka di {sourceName(selNode.url)}</span>
                  </a>
                  {(selNode.media?.length ?? 0) > 1 && (
                    <p className="text-[12px] leading-[1.5] text-muted">
                      {selNode.media!.length} foto dan video. Geser foto di kartu ke kiri atau kanan, atau pakai tombol panah. Pindahkan kartu lewat judulnya.
                    </p>
                  )}
                </Section>
              )}
              {selNode.type === "palette" && (
                <Section title="Warna palet">
                  {(selNode.swatches ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <ColorField
                        label={`Warna ${i + 1}`}
                        value={c}
                        swatches={boardColors}
                        onChange={(hex) => patchNode(selNode.id, { swatches: (selNode.swatches ?? []).map((x, j) => (j === i ? hex : x)) }, `swatch:${selNode.id}:${i}`)}
                      />
                      <button
                        type="button"
                        onClick={() => patchNode(selNode.id, { swatches: (selNode.swatches ?? []).filter((_, j) => j !== i) })}
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
                      onClick={() => patchNode(selNode.id, { swatches: [...(selNode.swatches ?? []), "#e8e7ef"] })}
                      className="h-10 rounded-xl border-[1.5px] border-dashed border-outline text-[12px] font-bold hover:bg-sunken"
                    >
                      Tambah warna
                    </button>
                  )}
                </Section>
              )}
              {isCard(selNode) && (
                <Section title="Tag">
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((t) => {
                      const on = selNode.tags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => patchNode(selNode.id, { tags: on ? selNode.tags.filter((x) => x !== t) : [...selNode.tags, t] })}
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
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = newTag.trim().replace(/\s+/g, " ").slice(0, MOOD_TAG_MAX);
                      if (!t) return;
                      const same = allTags.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
                      if (!selNode.tags.includes(same)) {
                        if (selNode.tags.length >= MOOD_LIMITS.tags) return flash(`Satu kartu maksimal ${MOOD_LIMITS.tags} tag.`);
                        patchNode(selNode.id, { tags: [...selNode.tags, same] });
                      }
                      setNewTag("");
                    }}
                  >
                    <Input aria-label="Tag baru" value={newTag} maxLength={MOOD_TAG_MAX} placeholder="Tag baru, misal Siraman" onChange={(e) => setNewTag(e.target.value)} className="min-w-0 flex-1" />
                    <button type="submit" disabled={!newTag.trim()} className="h-11 shrink-0 rounded-xl bg-ground px-3 text-[13px] font-bold hover:bg-[#e8e7ef] disabled:text-muted">
                      Tambah
                    </button>
                  </form>
                  <p className="text-[12px] text-muted">Tag buatan sendiri muncul di semua papan. Tag yang tidak dipakai kartu mana pun hilang dari daftar.</p>
                </Section>
              )}
              {!isStroke(selNode) && b.nodes.filter((n) => !isStroke(n)).length > 1 && (
                <Section title="Sambungan">
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        aria-label="Sambungkan ke elemen lain"
                        value={linkTarget}
                        onValueChange={setLinkTarget}
                        options={[
                          { value: "", label: "Pilih elemen" },
                          ...b.nodes.filter((n) => n.id !== selNode.id && !isStroke(n)).map((n) => ({ value: n.id, label: `${TYPE_LABEL[n.type]}: ${nodeLabel(n)}` })),
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
                </Section>
              )}
              <Section title="Susun">
                <div role="group" aria-label="Urutan lapisan" className="flex gap-0.5 rounded-xl bg-ground p-1">
                  <IconAction label="Paling depan (Ctrl+Shift+])" onClick={() => restack("front")}>
                    <ChevronsUp size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Maju satu (Ctrl+])" onClick={() => restack("forward")}>
                    <ArrowUp size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Mundur satu (Ctrl+[)" onClick={() => restack("backward")}>
                    <ArrowDown size={17} aria-hidden="true" />
                  </IconAction>
                  <IconAction label="Paling belakang (Ctrl+Shift+[)" onClick={() => restack("back")}>
                    <ChevronsDown size={17} aria-hidden="true" />
                  </IconAction>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={groupSelection} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]">
                    <Group size={16} aria-hidden="true" />
                    Kelompokkan
                  </button>
                  <button type="button" onClick={duplicateSelection} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]">
                    <Copy size={16} aria-hidden="true" />
                    Duplikat
                  </button>
                </div>
              </Section>
              <Section>
                <DangerButton onClick={removeSelection}>Hapus {isCard(selNode) ? "kartu" : "elemen"}</DangerButton>
              </Section>
            </>
          ) : selEdge ? (
            <>
              <PanelHead label="Sambungan" onDone={() => setSel(null)} />
              <Section>
                <dl className="flex flex-col gap-1.5 text-[14px]">
                  <div>
                    <dt className="text-[11px] font-semibold text-muted">Dari</dt>
                    <dd className="font-bold">{byId.get(selEdge.from) ? nodeLabel(byId.get(selEdge.from)!) : "Tanpa judul"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold text-muted">Ke</dt>
                    <dd className="font-bold">{byId.get(selEdge.to) ? nodeLabel(byId.get(selEdge.to)!) : "Tanpa judul"}</dd>
                  </div>
                </dl>
                <TextField label="Label sambungan" value={selEdge.label} max={80} placeholder="Misal: warna ikut ini" onChange={(v) => patchEdge(selEdge.id, { label: v }, `label:${selEdge.id}`)} />
              </Section>
              <Section>
                <DangerButton onClick={removeSelection}>Hapus sambungan</DangerButton>
              </Section>
            </>
          ) : selGroup ? (
            <>
              <PanelHead label="Kelompok" onDone={() => setSel(null)} />
              <Section>
                <TextField label="Nama kelompok" value={selGroup.title} max={80} placeholder="Misal: Pelaminan dan dekor" onChange={(v) => patchGroup(selGroup.id, { title: v }, `title:${selGroup.id}`)} />
              </Section>
              <Section title="Posisi dan ukuran">
                <GeometryFields r={selGroup} onChange={(p) => setGroupGeometry(selGroup, p)} />
                {selGroup.locked && (
                  <p className="text-[12px] leading-[1.5] text-muted">
                    Terkunci, jadi tidak bisa digeser di kanvas.{" "}
                    <button type="button" onClick={() => toggleLayer("group", selGroup.id, "locked")} className="hit-44 font-bold text-ink underline underline-offset-2">
                      Buka kunci
                    </button>
                  </p>
                )}
              </Section>
              <Section title="Warna latar">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(MOOD_GROUP_COLORS).map(([k, c]) => {
                    const on = selGroup.color === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patchGroup(selGroup.id, { color: k })}
                        className={cx("hit-44 flex h-9 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[12px] font-semibold", on ? "border-ink" : "border-line")}
                      >
                        <span className="size-3 rounded-full" style={{ background: c.bg, border: `1.5px solid ${c.line}` }} aria-hidden="true" />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Isi">
                <p className="text-[13px] leading-[1.5] text-muted">
                  {b.nodes.filter((n) => owners.get(n.id) === selGroup.id).length} elemen di dalam kelompok ini. Elemen ikut berpindah saat kelompok digeser.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={!b.nodes.some((n) => owners.get(n.id) === selGroup.id)}
                    onClick={() => setSel({ kind: "node", ids: b.nodes.filter((n) => owners.get(n.id) === selGroup.id && pickable(n)).map((n) => n.id) })}
                    className="h-11 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef] disabled:text-muted"
                  >
                    Pilih isinya
                  </button>
                  <button
                    type="button"
                    onClick={() => ungroup([selGroup.id])}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold hover:bg-[#e8e7ef]"
                  >
                    <Ungroup size={16} aria-hidden="true" />
                    Lepas
                  </button>
                </div>
              </Section>
              <Section>
                <DangerButton onClick={removeSelection}>Hapus kelompok</DangerButton>
                <p className="text-center text-[12px] text-muted">Elemen di dalamnya tidak ikut terhapus.</p>
              </Section>
            </>
          ) : (
            <>
              <div className="flex min-h-14 flex-col justify-center border-b border-line px-4 py-2">
                <h2 className="text-[14px] font-extrabold">Papan {boardName}</h2>
                <p className="text-[12px] text-muted">
                  {b.nodes.length} elemen dan {b.groups.length} kelompok
                </p>
              </div>
              <Section>
                <p className="text-[13px] leading-[1.5] text-muted">Pilih elemen di kanvas atau di panel Layer untuk mengubah isi, ukuran, dan urutannya di sini.</p>
              </Section>
              <Section title="Petunjuk">
                <div id="mb-help" className="flex flex-col gap-3 text-[13px] leading-[1.5]">
                  <Help title="Susun">
                    Tarik elemen untuk memindah. Tarik area kosong untuk memilih beberapa sekaligus. Geser kanvas dengan alat Tangan, tahan Spasi, atau satu jari di tablet. Ctrl dan scroll, atau cubit dua jari, untuk zoom.
                  </Help>
                  <Help title="Layer dan kelompok">
                    Ctrl+G mengelompokkan pilihan, Ctrl+Shift+G melepasnya. Ctrl+] dan Ctrl+[ memindah lapisan, tambah Shift untuk paling depan atau paling belakang. Kunci dan sembunyikan dari panel Layer.
                  </Help>
                  <Help title="Dari link">
                    Tempel link Instagram, Pinterest, atau situs lain dengan Ctrl+V di kanvas, atau pakai alat Link di bawah. Foto tidak terpotong, carousel jadi satu kartu, dan video bisa diputar.
                  </Help>
                  <Help title="Bersama">Kursor anggota lain terlihat dengan nama di bawahnya. Klik avatar di bar atas untuk mengikuti layarnya. Perubahan tersimpan otomatis.</Help>
                  <Help title="Keyboard">
                    V Pilih, H Tangan, C Sambung, P Pena, E Penghapus, R Bentuk, T Teks. Ctrl+Z batal, Ctrl+Shift+Z ulangi, Ctrl+D duplikat, Delete hapus, Esc batal.
                  </Help>
                </div>
              </Section>
            </>
          )}
        </aside>
      </div>
      <PhotoViewer
        photos={b.nodes.filter((n) => (n.type === "photo" && photoSrc(n)) || n.type === "media")}
        openId={viewer}
        onChange={setViewer}
        src={photoSrc}
        mediaSrc={mediaSrc}
      />
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={`Bagikan papan ${boardName}`} description="Untuk dekorator, MUA, atau vendor lain yang perlu melihat konsep tanpa membuat akun.">
        <div className="flex flex-col gap-3">
          {share[active] ? (
            <>
              <CopyLink url={shareUrl} />
              <p className="text-[13px] leading-[1.5] text-muted">
                Siapa pun yang punya link ini bisa melihat seluruh isi papan {boardName}, termasuk catatan dan tag, tapi tidak bisa mengubahnya. Papan lain tidak ikut terlihat.
              </p>
              <button
                type="button"
                disabled={sharing}
                onClick={() => toggleShare(false)}
                className="h-11 self-start rounded-xl border border-[#f1c9c4] px-4 text-[13px] font-bold text-danger hover:bg-[#fdf1ef] disabled:opacity-60"
              >
                {sharing ? "Mencabut…" : "Cabut link"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-[1.5] text-muted">
                Buat link baca-saja untuk papan {boardName}. Vendor bisa melihat foto, catatan, dan tag di papan ini dari HP, tanpa login. Link bisa dicabut kapan saja.
              </p>
              <button
                type="button"
                disabled={sharing}
                onClick={() => toggleShare(true)}
                className="h-11 self-start rounded-xl bg-ink px-4 text-[13px] font-bold text-white hover:bg-[#2e2d40] disabled:opacity-60"
              >
                {sharing ? "Membuat link…" : "Buat link untuk vendor"}
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

// Tombol alat di toolbar bawah: hanya ikon, nama dan pintasan ada di title dan aria-label.
const TOOL_CLASS = "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150";

function ToolButton({ hint, icon, on, onClick }: { label: string; hint: string; icon: React.ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={hint} aria-label={hint} aria-pressed={on} onClick={onClick} className={cx(TOOL_CLASS, on ? "bg-accent text-ink" : "hover:bg-ground")}>
      {icon}
    </button>
  );
}

/** Pegangan resize di sudut. Ukurannya dibagi zoom supaya tetap mudah disentuh saat papan diperkecil. */
function Handles({ zoom, corners, inset = -2, onDown }: { zoom: number; corners: Corner[]; inset?: number; onDown: (e: ReactPointerEvent, c: Corner) => void }) {
  const s = 32 / zoom;
  return (
    <>
      {corners.map((c) => (
        <div
          key={c}
          aria-hidden="true"
          onPointerDown={(e) => onDown(e, c)}
          className={cx("absolute z-[3] flex items-center justify-center", c === "nw" || c === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize")}
          style={{
            width: s,
            height: s,
            [c.includes("n") ? "top" : "bottom"]: inset - s / 2,
            [c.includes("w") ? "left" : "right"]: inset - s / 2,
          }}
        >
          <span className="rounded-[3px] border-solid border-ink bg-surface" style={{ width: 12 / zoom, height: 12 / zoom, borderWidth: 2 / zoom }} />
        </div>
      ))}
    </>
  );
}
