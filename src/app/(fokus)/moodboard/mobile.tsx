"use client";

// Moodboard di HP: galeri, bukan kanvas. Frame di papan tampil sebagai album, foto dan kartu link sebagai grid.
// Menyusun papan tetap di tablet atau laptop; di sini hanya melihat, menambah, dan menghapus referensi.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronLeft, ClipboardPaste, ExternalLink, Images, Layers, NotebookPen, Play, Plus, Trash2, X } from "lucide-react";
import type { MoodData, MoodMedia, MoodNode } from "@/db/schema";
import { applyOps, MOOD_BOARDS, MOOD_LIMITS, sourceName, type MoodBoardId, type MoodOp } from "@/lib/moodboard";
import { Button, cx, Input, Textarea } from "@/components/kit";
import { boxOf, MEDIA_FOOTER, SilentFor } from "./board-view";

gsap.registerPlugin(useGSAP);

type Boards = Record<MoodBoardId, MoodData>;
type AlbumRef = { board: MoodBoardId; id: string };
type Album = AlbumRef & { title: string; items: MoodNode[]; frame: MoodNode | null };
type Slide = { node: MoodNode; media: MoodMedia | null; index: number; count: number };
type Pending = { key: string; board: MoodBoardId; album: string; url: string | null; label: string };
type Rect = { x: number; y: number; w: number; h: number };
type Layer = "album" | "viewer" | "sheet" | "frame" | "note" | "confirm";
type Confirm = { title: string; body: string; action: string; run: () => Promise<void> };

const LOOSE = "lepas";
const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO = 10 * 1024 * 1024;
const MEDIA_W = { portrait: 260, landscape: 320 };
const MEDIA_MAX_H = 520;
const LAST_TARGET = "rukun:mood-target";
const EASE = "power3.out";

const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Durasi animasi: 0 bila pengguna meminta gerak dikurangi (DESIGN.md 9). */
const t = (s: number) => (calm() ? 0 : s);
const fileSrc = (id: string) => `/api/files/${id}`;
const isLink = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const isShown = (n: MoodNode) => !n.hidden && ((n.type === "photo" && !!n.fileId) || (n.type === "media" && !!n.media?.length));

/** Frame jadi album; foto di luar frame masuk satu album sendiri. Urutan isi: yang terakhir ditambahkan di depan. */
function albumsOf(board: MoodBoardId, d: MoodData): Album[] {
  const frames = d.nodes.filter((n) => n.type === "frame" && !n.hidden);
  const ids = new Set(frames.map((f) => f.id));
  const items = d.nodes.filter(isShown).reverse();
  const out: Album[] = frames.map((f) => ({ board, id: f.id, title: f.title || "Frame tanpa nama", frame: f, items: items.filter((n) => n.parent === f.id) }));
  const loose = items.filter((n) => !n.parent || !ids.has(n.parent));
  if (loose.length || !frames.length) out.push({ board, id: LOOSE, title: frames.length ? "Di luar frame" : "Semua foto", frame: null, items: loose });
  return out;
}

const slidesOf = (items: MoodNode[]): Slide[] =>
  items.flatMap((node): Slide[] =>
    node.type === "media" && node.media ? node.media.map((media, index) => ({ node, media, index, count: node.media!.length })) : [{ node, media: null, index: 0, count: 1 }],
  );

// Frame baru dari HP: muat tiga kartu per baris, dua baris. Bertambah tinggi sendiri saat penuh.
const FRAME = { w: 3 * (MEDIA_W.portrait + 24) + 24, h: 2 * (MEDIA_W.portrait + 72) + 48 };
const PAD = 24;

/** Semua kotak di papan: kartu yang tampil dan section. */
const boxesOf = (d: MoodData): Rect[] => [...d.nodes.filter((n) => !n.hidden).map((n) => boxOf(n)), ...d.groups.filter((g) => !g.hidden)];

/**
 * Tempat kosong untuk kartu baru. Di dalam frame: sel pertama yang tidak menabrak isinya; bila penuh, di bawah
 * isi terakhir dan frame diperpanjang (`grow`). Di luar frame: kolom di kanan semua isi papan, supaya susunan
 * yang sudah dirapikan di laptop tidak tertimpa.
 */
function spotFor(d: MoodData, frame: MoodNode | null, w: number, h: number): { x: number; y: number; grow?: number } {
  if (frame) {
    const f = boxOf(frame);
    const inside = d.nodes.filter((n) => n.parent === frame.id && !n.hidden).map((n) => boxOf(n));
    const free = (x: number, y: number) => !inside.some((b) => overlaps({ x: x - 12, y: y - 12, w: w + 24, h: h + 24 }, b));
    for (let y = f.y + PAD; y + h <= f.y + f.h - PAD; y += 32) for (let x = f.x + PAD; x + w <= f.x + f.w - PAD; x += 32) if (free(x, y)) return { x, y };
    const y = Math.max(f.y + PAD, ...inside.map((b) => b.y + b.h + PAD));
    return { x: f.x + PAD, y, grow: y + h + PAD - (f.y + f.h) };
  }
  const others = boxesOf(d);
  const free = (x: number, y: number) => !others.some((b) => overlaps({ x: x - 12, y: y - 12, w: w + 24, h: h + 24 }, b));
  if (!others.length) return { x: 0, y: 0 };
  const right = Math.max(...others.map((b) => b.x + b.w)) + 80;
  const top = Math.min(...others.map((b) => b.y));
  for (let c = 0; c < 20; c++) for (let y = top; y < top + 1600; y += 32) if (free(right + c * (MEDIA_W.landscape + 24), y)) return { x: right + c * (MEDIA_W.landscape + 24), y };
  return { x: right, y: top };
}

/** Frame baru di kanan semua isi papan, sejajar bagian atasnya. */
function frameSpot(d: MoodData) {
  const all = boxesOf(d);
  if (!all.length) return { x: 0, y: 0 };
  return { x: Math.max(...all.map((b) => b.x + b.w)) + 120, y: Math.min(...all.map((b) => b.y)) };
}

// Grid ala Pinterest: rasio asli, tapi foto yang sangat tinggi atau lebar dibatasi supaya grid tetap rapi.
const RATIO = { min: 0.6, max: 1.8 };
const clampRatio = (r: number) => Math.min(RATIO.max, Math.max(RATIO.min, r));
/**
 * Rasio yang sudah diketahui tanpa memuat gambar: ukuran dari link, atau bentuk kartu di papan. Pembagian kolom
 * memakai ini, jadi foto tidak pindah kolom saat gambarnya selesai dimuat.
 */
function stableRatio(n: MoodNode) {
  const m = n.media?.[0];
  if (m?.w && m.h) return clampRatio(m.h / m.w);
  const b = boxOf(n);
  return clampRatio(b.h / b.w);
}

/** Bagi kartu ke dua kolom: tiap kartu masuk kolom yang paling pendek, seperti Pinterest. */
function masonry<T>(tiles: T[], ratio: (t: T) => number) {
  const cols: T[][] = [[], []];
  const h = [0, 0];
  for (const tile of tiles) {
    const c = h[0] <= h[1] ? 0 : 1;
    cols[c].push(tile);
    h[c] += ratio(tile) + 0.04;
  }
  return cols;
}

/** Catatan milik foto: kartu catatan yang tersambung connector dengan foto itu, dari HP maupun dari laptop. */
function notesOf(d: MoodData, id: string) {
  const ids = new Set(d.edges.filter((e) => e.from === id || e.to === id).map((e) => (e.from === id ? e.to : e.from)));
  return d.nodes.filter((n) => n.type === "note" && ids.has(n.id));
}

// Kartu catatan: lebar bawaan kanvas, tinggi mengikuti isi supaya tidak terpotong.
const NOTE_W = 220;
function noteH(text: string) {
  const lines = text.split("\n").reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 28)), 0);
  return Math.min(480, Math.max(132, 56 + lines * 20));
}

/**
 * Tempat catatan baru: di kanan foto, lalu di bawah, kiri, atas. Di dalam frame hanya kanan dan bawah,
 * karena frame bisa diperlebar ke kanan dan diperpanjang ke bawah tanpa menggeser isinya.
 */
function noteSpot(d: MoodData, photo: MoodNode, frame: MoodNode | null, w: number, h: number) {
  const p = boxOf(photo);
  const others = d.nodes.filter((n) => !n.hidden && n.id !== photo.id && n.id !== frame?.id && n.type !== "frame").map((n) => boxOf(n));
  const frames = d.nodes.filter((n) => !n.hidden && n.type === "frame" && n.id !== frame?.id).map((n) => boxOf(n));
  const free = (x: number, y: number) => ![...others, ...frames].some((b) => overlaps({ x: x - 12, y: y - 12, w: w + 24, h: h + 24 }, b));
  const gap = 48;
  const all = [
    { x: p.x + p.w + gap, y: p.y },
    { x: p.x, y: p.y + p.h + gap },
    { x: p.x - w - gap, y: p.y },
    { x: p.x, y: p.y - h - gap },
  ];
  const hit = (frame ? all.slice(0, 2) : all).find((c) => free(c.x, c.y));
  if (hit) return hit;
  return spotFor(d, frame, w, h);
}

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
  });
}

/* ---------- Gambar kecil ---------- */

/** Foto pertama kartu: gambar, atau bingkai awal video. */
function Thumb({ node, className, onRatio }: { node: MoodNode; className?: string; onRatio?: (r: number) => void }) {
  const m = node.type === "media" ? node.media?.[0] : null;
  if (m?.kind === "video")
    return (
      <video
        src={`${fileSrc(m.fileId)}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => e.currentTarget.videoWidth && onRatio?.(e.currentTarget.videoHeight / e.currentTarget.videoWidth)}
        className={cx("pointer-events-none object-cover", className)}
      />
    );
  const id = m?.fileId ?? node.fileId;
  return id ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fileSrc(id)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onLoad={(e) => e.currentTarget.naturalWidth && onRatio?.(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
      className={cx("object-cover", className)}
    />
  ) : null;
}

/* ---------- Kartu album: tumpukan foto seperti folder Galeri ---------- */

function AlbumCard({ album, onOpen }: { album: Album; onOpen: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const top = album.items.slice(0, 3);
  // Foto paling depan digambar terakhir.
  const layers = [top[2], top[1], top[0]];
  const fan = (open: boolean) => {
    const el = ref.current;
    if (!el) return;
    const [a, b, c] = el.querySelectorAll<HTMLElement>("[data-layer]");
    gsap.to(a, { rotate: open ? -15 : -9, x: open ? -14 : -6, y: open ? -4 : 0, duration: t(0.35), ease: EASE });
    gsap.to(b, { rotate: open ? 14 : 8, x: open ? 14 : 6, y: open ? -4 : 0, duration: t(0.35), ease: EASE });
    gsap.to(c, { scale: open ? 0.95 : 1, duration: t(0.25), ease: EASE });
  };
  return (
    <button
      ref={ref}
      type="button"
      data-card
      onClick={() => ref.current && onOpen(ref.current)}
      onPointerDown={() => fan(true)}
      onPointerUp={() => fan(false)}
      onPointerLeave={() => fan(false)}
      onPointerCancel={() => fan(false)}
      className="flex min-w-0 flex-col items-center gap-2 rounded-[22px] p-2 text-center outline-offset-2 [-webkit-tap-highlight-color:transparent]"
    >
      <span className="relative block aspect-square w-full">
        {layers.map((n, i) => (
          <span
            key={i}
            data-layer
            style={{ transform: i === 0 ? "translateX(-6px) rotate(-9deg)" : i === 1 ? "translateX(6px) rotate(8deg)" : undefined }}
            className={cx(
              "absolute inset-[9%] overflow-hidden rounded-[18px] border-[3px] border-surface",
              n ? "bg-sunken" : i === 2 ? "bg-surface" : "bg-[#e8e7ef]",
              i === 2 && "shadow-[0_6px_16px_rgba(28,27,41,0.14)]",
            )}
          >
            {n ? (
              <Thumb node={n} className="size-full" />
            ) : (
              i === 2 && (
                <span className="flex size-full items-center justify-center text-muted">
                  <Images size={22} aria-hidden="true" />
                </span>
              )
            )}
          </span>
        ))}
      </span>
      <span className="line-clamp-2 text-[14px] leading-[1.3] font-bold">{album.title}</span>
      <span className="-mt-1.5 text-[12px] font-semibold text-muted">{album.items.length ? `${album.items.length} referensi` : "Belum ada foto"}</span>
    </button>
  );
}

/* ---------- Halaman utama ---------- */

export function MoodboardMobile({ initial, edit, shared }: { initial: Boards; edit: boolean; shared: string | null }) {
  const [boards, setBoards] = useState(initial);
  // Isi terbaru untuk antrean penempatan; selalu diubah bersama setBoards.
  const boardsRef = useRef(initial);
  const [album, setAlbum] = useState<AlbumRef | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  // Rasio asli foto (tinggi / lebar), diketahui setelah gambarnya termuat.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  // Lembar catatan foto: foto yang dicatati dan catatan yang diubah (null = catatan baru).
  const [noting, setNoting] = useState<{ board: MoodBoardId; photo: string; note: MoodNode | null } | null>(null);
  const noteSheetEl = useRef<HTMLDivElement>(null);
  // Lembar "Frame baru": papan tujuannya, null bila tertutup.
  const [framing, setFraming] = useState<MoodBoardId | null>(null);
  const frameSheetEl = useRef<HTMLDivElement>(null);
  // Slide yang sedang tampil di penampil foto.
  const [shown, setShown] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [target, setTarget] = useState<AlbumRef>({ board: "utama", id: LOOSE });
  const [link, setLink] = useState(shared ?? "");

  const root = useRef<HTMLDivElement>(null);
  const albumEl = useRef<HTMLDivElement>(null);
  const viewerEl = useRef<HTMLDivElement>(null);
  const sheetEl = useRef<HTMLDivElement>(null);
  const toastEl = useRef<HTMLDivElement>(null);
  const fabEl = useRef<HTMLButtonElement>(null);
  const queue = useRef(Promise.resolve());
  const clientId = useRef(`hp-${uid()}`);
  // Lapisan yang terbuka, paling atas di akhir. Tombol kembali HP menutup lapisan teratas.
  const stack = useRef<Layer[]>([]);
  // Popup konfirmasi hapus. `run` menghapus lalu menutup lapisan yang perlu ditutup.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const confirmEl = useRef<HTMLDivElement>(null);

  const flash = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  const albums = MOOD_BOARDS.map((b) => ({ ...b, albums: albumsOf(b.id, boards[b.id]) }));
  const current = album ? albums.find((b) => b.id === album.board)?.albums.find((a) => a.id === album.id) ?? null : null;
  const slides = current ? slidesOf(current.items) : [];
  /** Tinggi kartu di grid: rasio asli setelah gambarnya termuat, sebelum itu perkiraan dari papan. */
  const ratioOf = (n: MoodNode) => clampRatio(ratios[n.id] ?? stableRatio(n));

  /* ---------- Sinkron ---------- */

  // Kembali dari Instagram atau aplikasi lain: ambil isi terbaru, mungkin pasangan menambah dari laptop.
  useEffect(() => {
    const pull = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/moodboard/ops", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { boards: Record<MoodBoardId, { data: MoodData }> } | null) => {
          if (!j) return;
          boardsRef.current = Object.fromEntries(MOOD_BOARDS.map((b) => [b.id, j.boards[b.id].data])) as Boards;
          setBoards(boardsRef.current);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", pull);
    return () => document.removeEventListener("visibilitychange", pull);
  }, []);

  async function send(board: MoodBoardId, ops: MoodOp[]) {
    const res = await fetch("/api/moodboard/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board, clientId: clientId.current, ops }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Perubahan belum tersimpan.");
    boardsRef.current = { ...boardsRef.current, [board]: applyOps(boardsRef.current[board], ops) };
    setBoards(boardsRef.current);
  }

  /** Kartu baru ditaruh satu per satu, supaya dua unggahan yang selesai bersamaan tidak mendapat tempat yang sama. */
  function place(to: AlbumRef, make: (spot: (w: number, h: number) => { x: number; y: number }) => MoodNode) {
    const run = queue.current.then(async () => {
      const d = boardsRef.current[to.board];
      if (d.nodes.length >= MOOD_LIMITS.nodes) throw new Error(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
      const frame = to.id === LOOSE ? null : (d.nodes.find((n) => n.id === to.id && n.type === "frame") ?? null);
      let grow = 0;
      const node = make((w, h) => {
        const { grow: more = 0, ...at } = spotFor(d, frame, w, h);
        grow = more;
        return at;
      });
      const ops: MoodOp[] = [{ t: "put", c: "nodes", item: frame ? { ...node, parent: frame.id } : node }];
      // Frame penuh: diperpanjang ke bawah supaya kartu baru tetap di dalamnya.
      if (frame && grow > 0) ops.push({ t: "patch", c: "nodes", id: frame.id, set: { h: Math.min(20_000, boxOf(frame).h + grow) } });
      await send(to.board, ops);
    });
    queue.current = run.catch(() => {});
    return run;
  }

  const dropPending = (key: string) =>
    setPending((p) => {
      const hit = p.find((x) => x.key === key);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return p.filter((x) => x.key !== key);
    });

  function addPhotos(files: FileList | null, to: AlbumRef) {
    for (const f of Array.from(files ?? [])) {
      if (!PHOTO_MIME.includes(f.type)) {
        flash("Hanya foto JPG, PNG, atau WEBP yang bisa ditaruh di moodboard.");
        continue;
      }
      if (f.size > MAX_PHOTO) {
        flash(`${f.name} lebih dari 10 MB.`);
        continue;
      }
      const key = uid();
      const blob = URL.createObjectURL(f);
      // Kartu foto mengikuti bentuk asli foto (lebar 240), jadi di laptop foto tampil utuh dan grid HP tidak bergeser.
      const shape = naturalSize(blob, "image").then(({ w, h }) => Math.min(520, Math.max(140, Math.round((240 * h) / w))));
      setPending((p) => [...p, { key, board: to.board, album: to.id, url: blob, label: "Mengunggah…" }]);
      const fd = new FormData();
      fd.set("file", f);
      fd.set("kind", "moodboard");
      fetch("/api/upload", { method: "POST", body: fd })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Unggah gagal.");
          return data.id as string;
        })
        .then(async (fileId) => {
          const h = await shape;
          return place(to, (spot) => ({
            id: key,
            type: "photo",
            title: f.name.replace(/\.[^.]+$/, "").slice(0, 120),
            tags: [],
            fileId,
            w: 240,
            h,
            ...spot(240, h),
          }));
        })
        .catch((e: Error) => flash(e.message === "Failed to fetch" ? "Foto belum terunggah. Periksa koneksi lalu coba lagi." : e.message))
        .finally(() => dropPending(key));
    }
  }

  function addLink(url: string, to: AlbumRef) {
    const key = uid();
    setPending((p) => [...p, { key, board: to.board, album: to.id, url: null, label: `Mengambil dari ${sourceName(url)}…` }]);
    fetch("/api/moodboard/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Link ini tidak bisa diambil.");
        const media = data.items as MoodMedia[];
        const first = media[0];
        if (!first.w || !first.h) Object.assign(first, await naturalSize(fileSrc(first.fileId), first.kind));
        const ratio = first.h! / first.w!;
        const w = Math.max(140, Math.round(Math.min(ratio < 1 ? MEDIA_W.landscape : MEDIA_W.portrait, MEDIA_MAX_H / ratio)));
        const h = Math.round(w * ratio) + MEDIA_FOOTER;
        return place(to, (spot) => ({ id: key, type: "media", title: String(data.title ?? "").slice(0, 120), tags: [], url, media, w, h, ...spot(w, h) }));
      })
      .catch((e: Error) => flash(e.message === "Failed to fetch" ? "Link belum terambil. Periksa koneksi lalu coba lagi." : e.message))
      .finally(() => dropPending(key));
  }

  /** Frame baru langsung tersimpan di papan, jadi ikut muncul di kanvas laptop lewat aliran realtime. */
  async function addFrame(board: MoodBoardId, title: string) {
    const run = queue.current.then(async () => {
      const d = boardsRef.current[board];
      if (d.nodes.length >= MOOD_LIMITS.nodes) throw new Error(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
      const frame: MoodNode = { id: uid(), type: "frame", title: title.slice(0, 120), tags: [], fill: "#ffffff", ...frameSpot(d), ...FRAME };
      await send(board, [{ t: "put", c: "nodes", item: frame }]);
      return frame;
    });
    queue.current = run.then(() => {}).catch(() => {});
    return run;
  }

  /**
   * Catatan baru jadi kartu Catatan di papan, ditaruh di samping foto dan disambung connector ke foto itu,
   * jadi di laptop langsung tampil bersambung. Catatan yang sudah ada cukup diubah isinya.
   */
  function saveNote(board: MoodBoardId, photoId: string, note: MoodNode | null, title: string, text: string) {
    const run = queue.current.then(async () => {
      const d = boardsRef.current[board];
      if (note) {
        const cur = d.nodes.find((n) => n.id === note.id);
        if (!cur) throw new Error("Catatan ini sudah dihapus anggota lain.");
        const h = Math.max(boxOf(cur).h, noteH(text));
        return send(board, [{ t: "patch", c: "nodes", id: note.id, set: { title, text, h } }]);
      }
      const photo = d.nodes.find((n) => n.id === photoId);
      if (!photo) throw new Error("Foto ini sudah dihapus anggota lain.");
      if (d.nodes.length >= MOOD_LIMITS.nodes) throw new Error(`Papan ini sudah berisi ${MOOD_LIMITS.nodes} elemen.`);
      if (d.edges.length >= MOOD_LIMITS.edges) throw new Error(`Papan ini sudah berisi ${MOOD_LIMITS.edges} sambungan.`);
      const frame = photo.parent ? (d.nodes.find((n) => n.id === photo.parent && n.type === "frame") ?? null) : null;
      const h = noteH(text);
      const { x, y } = noteSpot(d, photo, frame, NOTE_W, h);
      const id = uid();
      const ops: MoodOp[] = [
        { t: "put", c: "nodes", item: { id, type: "note", title, text, tags: [], x, y, w: NOTE_W, h, ...(frame && { parent: frame.id }) } },
        { t: "put", c: "edges", item: { id: uid(), from: photoId, to: id, label: "" } },
      ];
      // Catatan di dalam frame: frame diperlebar atau diperpanjang bila catatannya keluar tepi.
      if (frame) {
        const f = boxOf(frame);
        const w2 = Math.max(f.w, x + NOTE_W + PAD - f.x);
        const h2 = Math.max(f.h, y + h + PAD - f.y);
        if (w2 > f.w || h2 > f.h) ops.push({ t: "patch", c: "nodes", id: frame.id, set: { w: Math.min(20_000, w2), h: Math.min(20_000, h2) } });
      }
      return send(board, ops);
    });
    queue.current = run.catch(() => {});
    return run;
  }

  /** Popup hapus. Setelah berhasil, popup dan lapisan di bawahnya (foto penuh atau lembar catatan) ditutup bersama. */
  function askDelete(c: Omit<Confirm, "run">, board: MoodBoardId, id: string, done: string) {
    setConfirm({
      ...c,
      run: async () => {
        try {
          await send(board, [{ t: "del", c: "nodes", id }]);
          history.go(-2);
          flash(done);
        } catch (e) {
          flash(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Belum terhapus. Periksa koneksi lalu coba lagi.");
        }
      },
    });
    push("confirm");
  }

  /* ---------- Lapisan dan tombol kembali ---------- */

  const push = (layer: Layer) => {
    stack.current.push(layer);
    history.pushState({ mood: layer, depth: stack.current.length }, "");
  };
  // Semua tombol tutup lewat history.back(), jadi tombol kembali HP dan tombol di layar berjalan sama.
  const back = () => history.back();

  const closeAlbum = useCallback(() => {
    const el = albumEl.current;
    if (!el) return setAlbum(null);
    gsap.to(el, { xPercent: 100, duration: t(0.4), ease: "power3.inOut", onComplete: () => setAlbum(null) });
    gsap.to(root.current, { xPercent: 0, autoAlpha: 1, duration: t(0.4), ease: "power3.inOut" });
  }, []);

  const closeSheet = useCallback(() => {
    const el = sheetEl.current;
    if (!el) return setSheet(false);
    gsap.to(el.querySelector("[data-panel]"), { yPercent: 100, duration: t(0.3), ease: "power2.in" });
    gsap.to(el.querySelector("[data-backdrop]"), { autoAlpha: 0, duration: t(0.3), onComplete: () => setSheet(false) });
  }, []);

  const closeFrameSheet = useCallback(() => {
    const el = frameSheetEl.current;
    if (!el) return setFraming(null);
    gsap.to(el.querySelector("[data-panel]"), { yPercent: 100, duration: t(0.3), ease: "power2.in" });
    gsap.to(el.querySelector("[data-backdrop]"), { autoAlpha: 0, duration: t(0.3), onComplete: () => setFraming(null) });
  }, []);

  const closeNoteSheet = useCallback(() => {
    const el = noteSheetEl.current;
    if (!el) return setNoting(null);
    gsap.to(el.querySelector("[data-panel]"), { yPercent: 100, duration: t(0.3), ease: "power2.in" });
    gsap.to(el.querySelector("[data-backdrop]"), { autoAlpha: 0, duration: t(0.3), onComplete: () => setNoting(null) });
  }, []);

  const closeConfirm = useCallback(() => {
    const el = confirmEl.current;
    if (!el) return setConfirm(null);
    gsap.to(el.querySelector("[data-panel]"), { scale: 0.94, autoAlpha: 0, duration: t(0.2), ease: "power2.in" });
    gsap.to(el.querySelector("[data-backdrop]"), { autoAlpha: 0, duration: t(0.22), onComplete: () => setConfirm(null) });
  }, []);

  const closeViewer = useRef<() => void>(() => setViewer(null));

  useEffect(() => {
    // Tiap entri riwayat menyimpan jumlah lapisan yang terbuka, jadi mundur dua langkah sekaligus
    // (hapus dari popup) menutup dua lapisan.
    const onPop = (e: PopStateEvent) => {
      const keep = (e.state as { depth?: number } | null)?.depth ?? 0;
      while (stack.current.length > keep) {
        const layer = stack.current.pop();
        if (layer === "album") closeAlbum();
        if (layer === "sheet") closeSheet();
        if (layer === "frame") closeFrameSheet();
        if (layer === "note") closeNoteSheet();
        if (layer === "confirm") closeConfirm();
        if (layer === "viewer") closeViewer.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [closeAlbum, closeSheet, closeFrameSheet, closeNoteSheet, closeConfirm]);

  function openAlbum(a: AlbumRef) {
    setAlbum(a);
    push("album");
  }
  function openSheet(to?: AlbumRef) {
    let next = to;
    if (!next) {
      try {
        const saved = JSON.parse(localStorage.getItem(LAST_TARGET) ?? "null") as AlbumRef | null;
        if (saved && MOOD_BOARDS.some((b) => b.id === saved.board)) next = saved;
      } catch {}
    }
    setTarget(next ?? { board: "utama", id: LOOSE });
    setSheet(true);
    push("sheet");
  }

  // Dibuka dari menu Bagikan (Android): langsung tampilkan lembar tambah dengan link terisi.
  const sharedOnce = useRef(false);
  useEffect(() => {
    if (!shared || sharedOnce.current) return;
    sharedOnce.current = true;
    history.replaceState(null, "", "/moodboard");
    openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  /* ---------- Animasi ---------- */

  // Kartu album muncul berurutan saat halaman dibuka; tombol Tambah muncul terakhir.
  useGSAP(
    () => {
      if (fabEl.current) gsap.from(fabEl.current, { scale: 0.6, autoAlpha: 0, duration: t(0.45), ease: "back.out(1.8)", delay: t(0.35) });
      gsap.from("[data-card]", { y: 18, autoAlpha: 0, duration: t(0.55), ease: EASE, stagger: t(0.045) });
      gsap.from("[data-section]", { autoAlpha: 0, duration: t(0.4), stagger: t(0.08) });
    },
    { scope: root },
  );

  // Album masuk dari kanan, halaman utama bergeser sedikit ke kiri seperti di aplikasi Galeri.
  useGSAP(
    () => {
      if (!album || !albumEl.current) return;
      gsap.fromTo(albumEl.current, { xPercent: 100 }, { xPercent: 0, duration: t(0.45), ease: EASE });
      gsap.to(root.current, { xPercent: -18, autoAlpha: 0.5, duration: t(0.45), ease: EASE });
      gsap.from(albumEl.current.querySelectorAll("[data-tile]"), { scale: 0.9, autoAlpha: 0, duration: t(0.4), ease: EASE, stagger: { each: t(0.025), from: "start" }, delay: t(0.12) });
    },
    { dependencies: [album?.board, album?.id] },
  );

  // Kartu baru (selesai diunggah atau diambil dari link) muncul dengan pop kecil.
  const known = useRef(new Set<string>());
  const tileIds = current ? [...pending.filter((p) => p.board === current.board && p.album === current.id).map((p) => p.key), ...current.items.map((n) => n.id)] : [];
  useGSAP(
    () => {
      const el = albumEl.current;
      if (!el) return void known.current.clear();
      const fresh = tileIds.filter((id) => !known.current.has(id));
      if (known.current.size)
        for (const id of fresh) {
          const tile = el.querySelector(`[data-tile="${id}"]`);
          if (tile) gsap.from(tile, { scale: 0.6, autoAlpha: 0, duration: t(0.5), ease: "back.out(1.6)" });
        }
      known.current = new Set(tileIds);
    },
    { dependencies: [tileIds.join(",")] },
  );

  useGSAP(
    () => {
      if (!sheet || !sheetEl.current) return;
      gsap.fromTo(sheetEl.current.querySelector("[data-backdrop]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t(0.3) });
      gsap.fromTo(sheetEl.current.querySelector("[data-panel]"), { yPercent: 100 }, { yPercent: 0, duration: t(0.45), ease: EASE });
    },
    { dependencies: [sheet] },
  );

  useGSAP(
    () => {
      if (!confirm || !confirmEl.current) return;
      gsap.fromTo(confirmEl.current.querySelector("[data-backdrop]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t(0.25) });
      gsap.fromTo(confirmEl.current.querySelector("[data-panel]"), { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: t(0.35), ease: "back.out(1.7)" });
    },
    { dependencies: [!!confirm] },
  );

  useGSAP(
    () => {
      if (!noting || !noteSheetEl.current) return;
      gsap.fromTo(noteSheetEl.current.querySelector("[data-backdrop]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t(0.3) });
      gsap.fromTo(noteSheetEl.current.querySelector("[data-panel]"), { yPercent: 100 }, { yPercent: 0, duration: t(0.45), ease: EASE });
    },
    { dependencies: [!!noting] },
  );

  useGSAP(
    () => {
      if (!framing || !frameSheetEl.current) return;
      gsap.fromTo(frameSheetEl.current.querySelector("[data-backdrop]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t(0.3) });
      gsap.fromTo(frameSheetEl.current.querySelector("[data-panel]"), { yPercent: 100 }, { yPercent: 0, duration: t(0.45), ease: EASE });
    },
    { dependencies: [framing] },
  );

  useGSAP(
    () => {
      if (!toast || !toastEl.current) return;
      gsap.fromTo(toastEl.current, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: t(0.3), ease: EASE });
      gsap.to(toastEl.current, { y: 16, autoAlpha: 0, duration: t(0.3), delay: 3.5, onComplete: () => setToast(null) });
    },
    { dependencies: [toast?.id] },
  );

  /* ---------- Penampil foto: foto terbang dari grid ke layar penuh ---------- */

  const flight = (src: string, from: DOMRect, to: DOMRect, radius: [number, number], onDone: () => void) => {
    const img = document.createElement("img");
    img.src = src;
    Object.assign(img.style, { position: "fixed", zIndex: "80", objectFit: "cover", pointerEvents: "none", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: `${radius[0]}px` });
    document.body.appendChild(img);
    gsap.to(img, {
      left: to.left,
      top: to.top,
      width: to.width,
      height: to.height,
      borderRadius: radius[1],
      duration: t(0.42),
      ease: "power3.inOut",
      onComplete: () => {
        onDone();
        img.remove();
      },
    });
  };
  const thumbOf = (id: string) => albumEl.current?.querySelector<HTMLElement>(`[data-tile="${id}"] img`) ?? null;
  const visible = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight && r.width > 0;

  function openViewer(i: number) {
    setViewer(i);
    setShown(i);
    push("viewer");
  }

  useLayoutEffect(() => {
    if (viewer === null || !viewerEl.current) return;
    const el = viewerEl.current;
    const track = el.querySelector<HTMLElement>("[data-track]")!;
    track.scrollLeft = viewer * track.clientWidth;
    track.focus({ preventScroll: true });
    gsap.fromTo(el.querySelector("[data-shade]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t(0.35) });
    gsap.fromTo(el.querySelectorAll("[data-chrome]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: t(0.35), delay: t(0.2), ease: EASE });
    const s = slides[viewer];
    const thumb = s && s.index === 0 ? thumbOf(s.node.id) : null;
    const real = el.querySelector<HTMLImageElement>(`[data-slide="${viewer}"] img`);
    if (!thumb || !real || calm()) return;
    real.style.opacity = "0";
    const go = () => {
      const to = real.getBoundingClientRect();
      if (!to.width) return void (real.style.opacity = "1");
      flight(real.src, thumb.getBoundingClientRect(), to, [12, 0], () => (real.style.opacity = "1"));
    };
    if (real.complete) go();
    else real.addEventListener("load", go, { once: true });
    // Hanya saat penampil dibuka; geser antar-foto tidak memicu ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer === null]);

  useEffect(() => {
    closeViewer.current = () => {
    const el = viewerEl.current;
    if (!el) return setViewer(null);
    const s = slides[shown];
    const thumb = s ? thumbOf(s.node.id) : null;
    const real = el.querySelector<HTMLImageElement>(`[data-slide="${shown}"] img`);
    const end = () => {
      setViewer(null);
      thumb?.closest("button")?.focus({ preventScroll: true });
    };
    gsap.to(el.querySelectorAll("[data-chrome]"), { autoAlpha: 0, duration: t(0.15) });
    gsap.to(el.querySelector("[data-shade]"), { autoAlpha: 0, duration: t(0.38) });
    const tr = thumb?.getBoundingClientRect();
    if (thumb && real && tr && visible(tr) && !calm()) {
      const from = real.getBoundingClientRect();
      real.style.opacity = "0";
      flight(real.src, from, thumb.getBoundingClientRect(), [0, 12], end);
    } else gsap.to(el.querySelector("[data-track]"), { autoAlpha: 0, scale: 0.94, duration: t(0.3), onComplete: end });
    };
  });

  /* ---------- Geser antar-foto ---------- */

  // Efek geser: foto yang menjauh dari tengah mengecil dan memudar, foto berikutnya membesar masuk.
  const swipeFx = useCallback((track: HTMLElement) => {
    if (calm()) return;
    const pos = track.scrollLeft / track.clientWidth;
    track.querySelectorAll<HTMLElement>("[data-slide]").forEach((el, i) => {
      const d = Math.min(1, Math.abs(i - pos));
      if (d >= 1 && el.dataset.fx === "1") return;
      el.dataset.fx = d >= 1 ? "1" : "0";
      const media = el.firstElementChild as HTMLElement | null;
      if (media) gsap.set(media, { scale: 1 - d * 0.14, autoAlpha: 1 - d * 0.55, rotate: (i - pos) * 3 });
    });
  }, []);

  /** Pindah ke slide `i` dengan animasi; dipakai tombol panah dan seret mouse. */
  const goTo = useCallback((i: number) => {
    const track = viewerEl.current?.querySelector<HTMLElement>("[data-track]");
    if (!track) return;
    const max = track.querySelectorAll("[data-slide]").length - 1;
    const to = Math.max(0, Math.min(max, i));
    track.style.scrollSnapType = "none";
    gsap.to(track, {
      scrollLeft: to * track.clientWidth,
      duration: t(0.45),
      ease: "power3.out",
      onUpdate: () => swipeFx(track),
      onComplete: () => {
        track.style.scrollSnapType = "";
      },
    });
  }, [swipeFx]);

  /*
   * Gestur di foto penuh. Geser ke samping: sentuhan ditangani scroll-snap bawaan browser, mouse diseret di sini.
   * Geser ke bawah (sentuhan atau mouse): foto ikut turun, mengecil, latar memudar; dilepas cukup jauh atau cepat
   * menutup foto penuh, kalau tidak foto kembali ke tengah. `touch-action: pan-x` di track membuat gerak vertikal
   * sampai ke sini, bukan ke browser.
   */
  const gesture = useRef<{ x: number; y: number; t: number; left: number; mode: "h" | "v" | null; mouse: boolean } | null>(null);
  const slideMedia = (track: HTMLElement) => track.querySelector<HTMLElement>(`[data-slide="${shown}"] > div`);

  function onTrackDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("video")) return;
    const track = e.currentTarget;
    const mouse = e.pointerType === "mouse";
    if (mouse) gsap.killTweensOf(track);
    gesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), left: track.scrollLeft, mode: null, mouse };
  }

  function onTrackMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const track = e.currentTarget;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.mode) {
      if (Math.hypot(dx, dy) < 8) return;
      // Arah ditentukan sekali di awal gerakan, supaya geser samping tidak ikut menutup.
      if (Math.abs(dy) > Math.abs(dx) && dy > 0) g.mode = "v";
      else if (g.mouse) g.mode = "h";
      else return void (gesture.current = null);
      track.setPointerCapture(e.pointerId);
      if (g.mode === "h") track.style.scrollSnapType = "none";
    }
    if (g.mode === "h") {
      track.scrollLeft = g.left - dx;
      return;
    }
    const down = Math.max(0, dy);
    const media = slideMedia(track);
    if (media) gsap.set(media, { x: dx * 0.5, y: down, scale: 1 - Math.min(0.35, down / 900), rotate: 0 });
    const el = viewerEl.current;
    if (el) {
      gsap.set(el.querySelector("[data-shade]"), { autoAlpha: 1 - Math.min(0.85, down / 400) });
      gsap.set(el.querySelectorAll("[data-chrome]"), { autoAlpha: down > 24 ? 0 : 1 });
    }
  }

  function onTrackUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.mode) return;
    const track = e.currentTarget;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const speed = Math.hypot(dx, dy) / Math.max(1, performance.now() - g.t);
    if (g.mode === "h") {
      const start = Math.round(g.left / track.clientWidth);
      // Seret cepat atau lebih dari seperlima layar: pindah satu foto.
      return goTo(speed > 0.4 || Math.abs(dx) > track.clientWidth / 5 ? start - Math.sign(dx) : start);
    }
    // Cukup jauh atau sentakan cepat ke bawah: tutup. Foto terbang dari posisinya sekarang ke grid.
    if (e.type === "pointerup" && (dy > 120 || (speed > 0.6 && dy > 40))) return back();
    const el = viewerEl.current;
    const media = slideMedia(track);
    if (media) gsap.to(media, { x: 0, y: 0, scale: 1, duration: t(0.35), ease: "back.out(1.4)" });
    if (el) {
      gsap.to(el.querySelector("[data-shade]"), { autoAlpha: 1, duration: t(0.25) });
      gsap.to(el.querySelectorAll("[data-chrome]"), { autoAlpha: 1, duration: t(0.25) });
    }
  }

  // Video di slide lain berhenti saat digeser.
  useEffect(() => {
    viewerEl.current?.querySelectorAll<HTMLVideoElement>("[data-slide] video").forEach((v) => {
      if (v.closest("[data-slide]")?.getAttribute("data-slide") !== String(shown)) v.pause();
    });
  }, [shown]);

  /* ---------- Tampilan ---------- */

  const slide = viewer !== null ? slides[shown] : null;

  return (
    <div className="relative -m-3 min-h-dvh overflow-x-clip">
      <div ref={root} className="px-4 pt-3 pb-28">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-[13px] font-bold text-ink no-underline">
              <ChevronLeft size={18} aria-hidden="true" />
              Beranda
            </Link>
          </div>
          <div>
            <h1 className="text-[28px] leading-[1.2] font-extrabold tracking-[-0.02em]">Moodboard</h1>
            <p className="mt-1 text-[14px] text-muted">Tiap frame di papan tampil sebagai album. Menyusun dan menyambung foto tetap di tablet atau laptop.</p>
          </div>
        </header>

        {albums.map((b) => (
          <section key={b.id} className="mt-7" aria-labelledby={`papan-${b.id}`}>
            <div data-section className="flex items-center gap-3">
              <h2 id={`papan-${b.id}`} className="text-[13px] font-bold text-muted">
                {b.name}
              </h2>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-4">
              {b.albums.map((a) => (
                <AlbumCard key={a.id} album={a} onOpen={() => openAlbum(a)} />
              ))}
              {edit && (
                <button
                  type="button"
                  data-card
                  onClick={() => {
                    setFraming(b.id);
                    push("frame");
                  }}
                  className="flex min-w-0 flex-col items-center gap-2 rounded-[22px] p-2 text-center [-webkit-tap-highlight-color:transparent] active:opacity-70"
                >
                  <span className="relative block aspect-square w-full">
                    <span className="absolute inset-[9%] flex items-center justify-center rounded-[18px] border-2 border-dashed border-outline text-muted">
                      <Plus size={24} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="text-[14px] leading-[1.3] font-bold">Frame baru</span>
                  <span className="-mt-1.5 text-[12px] font-semibold text-muted">Jadi album baru</span>
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {current && (
        <div
          ref={albumEl}
          className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-ground"
          role="region"
          aria-label={`Album ${current.title}`}
          onKeyDown={(e) => {
            if (e.key === "Escape" && viewer === null && !sheet) back();
          }}
        >
          <header className="sticky top-0 z-10 flex items-center gap-2 bg-ground/90 px-2 py-2 backdrop-blur-md">
            <button type="button" onClick={back} aria-label="Kembali ke album" className="inline-flex size-11 items-center justify-center rounded-xl">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] leading-[1.3] font-extrabold">{current.title}</h2>
              <p className="text-[12px] font-semibold text-muted">{MOOD_BOARDS.find((b) => b.id === current.board)?.name}</p>
            </div>
          </header>

          {tileIds.length ? (
            <div className="flex gap-1.5 px-1.5 pb-28">
              {masonry(
                [
                  ...pending.filter((p) => p.board === current.board && p.album === current.id).map((p) => ({ key: p.key, pending: p, node: null })),
                  ...current.items.map((n) => ({ key: n.id, pending: null, node: n })),
                ],
                (tile) => (tile.node ? stableRatio(tile.node) : 1),
              ).map((col, c) => (
                <div key={c} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {col.map(({ key, pending: p, node: n }) =>
                    p ? (
                      <div key={key} data-tile={key} className="relative aspect-square overflow-hidden rounded-[14px] bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.url && <img src={p.url} alt="" className="size-full object-cover opacity-60" />}
                        <span className="absolute inset-x-2 bottom-2 rounded-md bg-ink px-1.5 py-[3px] text-center text-[11px] font-bold text-white">{p.label}</span>
                      </div>
                    ) : (
                      n && (
                        <button
                          key={key}
                          type="button"
                          data-tile={n.id}
                          onClick={() => openViewer(slides.findIndex((s) => s.node.id === n.id))}
                          aria-label={`Lihat ${n.title || (n.url ? `dari ${sourceName(n.url)}` : "foto")}`}
                          style={{ aspectRatio: `1 / ${ratioOf(n)}` }}
                          className="relative overflow-hidden rounded-[14px] bg-sunken [-webkit-tap-highlight-color:transparent] active:opacity-80"
                        >
                          <Thumb node={n} className="size-full" onRatio={(r) => ratios[n.id] !== r && setRatios((x) => ({ ...x, [n.id]: r }))} />
                          <span className="absolute top-2 right-2 flex gap-1">
                            {n.media?.[0]?.kind === "video" && <SilentFor src={fileSrc(n.media[0].fileId)} size="sm" />}
                            {n.media?.[0]?.kind === "video" && (n.media?.length ?? 1) === 1 && (
                              <span className="flex size-6 items-center justify-center rounded-md bg-ink/70 text-white">
                                <Play size={12} fill="currentColor" aria-hidden="true" />
                              </span>
                            )}
                            {(n.media?.length ?? 1) > 1 && (
                              <span className="flex h-6 items-center gap-1 rounded-md bg-ink/70 px-1.5 text-[11px] font-bold text-white">
                                <Layers size={12} aria-hidden="true" />
                                {n.media!.length}
                              </span>
                            )}
                          </span>
                          {notesOf(boards[current.board], n.id).length > 0 && (
                            <span className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-md bg-note-bg text-note-fg" title="Ada catatan">
                              <NotebookPen size={13} aria-hidden="true" />
                              <span className="sr-only">Ada catatan</span>
                            </span>
                          )}
                        </button>
                      )
                    ),
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-4 mt-6 flex flex-col items-start gap-3 rounded-[22px] bg-surface p-5">
              <p className="text-[15px] font-bold">Album ini belum berisi foto</p>
              <p className="text-[14px] text-muted">
                {edit ? "Tempel link Instagram atau Pinterest, atau pilih foto dari galeri HP." : "Foto yang ditambahkan anggota lain akan tampil di sini."}
              </p>
              {edit && (
                <Button onClick={() => openSheet(current)}>
                  <Plus size={16} aria-hidden="true" />
                  Tambah referensi
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {current && viewer !== null && (
        <div
          ref={viewerEl}
          className="on-ink fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Foto referensi"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !confirm && !noting) back();
          }}
        >
          <div data-shade className="absolute inset-0 bg-[#100f18]" />
          <div
            data-track
            tabIndex={-1}
            className="absolute inset-0 flex touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => {
              const el = e.currentTarget;
              swipeFx(el);
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== shown && slides[i]) setShown(i);
            }}
            onPointerDown={onTrackDown}
            onPointerMove={onTrackMove}
            onPointerUp={onTrackUp}
            onPointerCancel={onTrackUp}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") goTo(shown + 1);
              if (e.key === "ArrowLeft") goTo(shown - 1);
            }}
          >
            {slides.map((s, i) => {
              const id = s.media?.fileId ?? s.node.fileId!;
              return (
                <div key={`${s.node.id}-${s.index}`} data-slide={i} className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2 pt-16 pb-56">
                  <div className="flex size-full items-center justify-center will-change-transform">
                    {s.media?.kind === "video" ? (
                      <video src={fileSrc(id)} controls playsInline preload="metadata" className="max-h-full max-w-full rounded-lg" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileSrc(id)}
                        alt={s.node.title}
                        loading={Math.abs(i - shown) < 2 ? "eager" : "lazy"}
                        draggable={false}
                        className="block h-auto max-h-full w-auto max-w-full select-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div data-chrome className="absolute inset-x-0 top-0 flex items-center justify-between px-2 pt-[max(8px,env(safe-area-inset-top))] text-white">
            <button type="button" onClick={back} aria-label="Tutup" className="inline-flex size-11 items-center justify-center rounded-xl">
              <X size={22} aria-hidden="true" />
            </button>
            <span className="text-[13px] font-semibold text-white/80">
              {shown + 1} dari {slides.length}
            </span>
            <span className="flex size-11 items-center justify-center">
              {slide?.media?.kind === "video" && <SilentFor src={fileSrc(slide.media.fileId)} className="bg-white/15" />}
            </span>
          </div>

          {slide && (
            <ViewerInfo
              key={slide.node.id}
              slide={slide}
              edit={edit}
              notes={notesOf(boards[current.board], slide.node.id)}
              onNote={(note) => {
                setNoting({ board: current.board, photo: slide.node.id, note });
                push("note");
              }}
              onDelete={() => {
                const n = slide.node;
                const count = n.media?.length ?? 1;
                const kept = notesOf(boards[current.board], n.id).length;
                askDelete(
                  {
                    title: count > 1 ? `Hapus post ini (${count} foto)?` : "Hapus foto ini?",
                    body: `${count > 1 ? "Semua foto di post ini" : "Foto ini"} hilang dari papan ${MOOD_BOARDS.find((b) => b.id === current.board)?.name}, juga di laptop.${kept ? " Catatannya tetap ada di papan." : ""}`,
                    action: "Hapus",
                  },
                  current.board,
                  n.id,
                  "Referensi dihapus dari papan.",
                );
              }}
            />
          )}
        </div>
      )}

      {sheet && (
        <AddSheet
          ref={sheetEl}
          target={target}
          setTarget={setTarget}
          boards={albums}
          link={link}
          setLink={setLink}
          onClose={back}
          onLink={(url, to) => {
            localStorage.setItem(LAST_TARGET, JSON.stringify(to));
            setLink("");
            addLink(url, to);
            back();
            if (album?.board !== to.board || album?.id !== to.id) setTimeout(() => openAlbum(to), 350);
          }}
          onFiles={(files, to) => {
            localStorage.setItem(LAST_TARGET, JSON.stringify(to));
            addPhotos(files, to);
            back();
            if (album?.board !== to.board || album?.id !== to.id) setTimeout(() => openAlbum(to), 350);
          }}
        />
      )}

      {framing && (
        <FrameSheet
          ref={frameSheetEl}
          boardName={MOOD_BOARDS.find((b) => b.id === framing)!.name}
          onClose={back}
          onCreate={async (title) => {
            const board = framing;
            try {
              const f = await addFrame(board, title);
              back();
              setTimeout(() => openAlbum({ board, id: f.id }), 350);
            } catch (e) {
              flash(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Frame belum tersimpan. Periksa koneksi lalu coba lagi.");
            }
          }}
        />
      )}

      {noting && (
        <NoteSheet
          key={noting.note?.id ?? "baru"}
          ref={noteSheetEl}
          note={noting.note}
          onClose={back}
          onSave={async (title, text) => {
            try {
              await saveNote(noting.board, noting.photo, noting.note, title, text);
              back();
              flash(noting.note ? "Catatan disimpan." : "Catatan disimpan dan tersambung ke foto di papan.");
            } catch (e) {
              flash(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Catatan belum tersimpan. Periksa koneksi lalu coba lagi.");
            }
          }}
          onDelete={() => {
            if (!noting.note) return;
            askDelete(
              { title: "Hapus catatan ini?", body: `"${noting.note.title || "Catatan"}" hilang dari papan, juga di laptop.`, action: "Hapus catatan" },
              noting.board,
              noting.note.id,
              "Catatan dihapus.",
            );
          }}
        />
      )}

      {confirm && <ConfirmDialog ref={confirmEl} {...confirm} onCancel={back} />}

      {edit && (
        <button
          ref={fabEl}
          type="button"
          onClick={() => openSheet(current ?? undefined)}
          aria-label={current ? `Tambah referensi ke ${current.title}` : "Tambah referensi"}
          className="fixed right-4 bottom-[max(20px,calc(env(safe-area-inset-bottom)+12px))] z-[45] inline-flex h-14 items-center gap-2 rounded-xl bg-ink pr-5 pl-4 text-[14px] font-bold text-white shadow-[0_10px_30px_rgba(28,27,41,0.28)] [-webkit-tap-highlight-color:transparent] active:bg-[#0f0e1a]"
        >
          <Plus size={20} aria-hidden="true" />
          Tambah
        </button>
      )}

      {toast && (
        <div ref={toastEl} role="status" className="fixed inset-x-4 bottom-[max(88px,calc(env(safe-area-inset-bottom)+80px))] z-[90] rounded-2xl bg-ink px-4 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(28,27,41,0.16)]">
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ---------- Keterangan di bawah foto penuh ---------- */

function ViewerInfo({
  slide,
  edit,
  notes,
  onNote,
  onDelete,
}: {
  slide: Slide;
  edit: boolean;
  notes: MoodNode[];
  onNote: (note: MoodNode | null) => void;
  onDelete: () => void;
}) {
  const n = slide.node;
  const action = "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-white/10 px-2 text-[12px] font-bold text-white no-underline transition-colors duration-150 active:bg-white/20";
  const count = (edit ? 2 : 0) + (n.url ? 1 : 0);
  return (
    <div data-chrome className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-[#100f18] from-60% to-transparent px-4 pt-10 pb-[max(16px,env(safe-area-inset-bottom))] text-white">
      {(n.title || slide.count > 1 || !!n.tags.length) && (
        <div className="flex flex-col gap-2">
          {(n.title || slide.count > 1) && (
            <div className="flex items-baseline justify-between gap-3">
              <p className="line-clamp-2 min-w-0 text-[14px] font-semibold">{n.title}</p>
              {slide.count > 1 && (
                <span className="shrink-0 text-[12px] font-semibold text-white/70">
                  Slide {slide.index + 1} dari {slide.count}
                </span>
              )}
            </div>
          )}
          {!!n.tags.length && (
            <div className="flex flex-wrap gap-1.5">
              {n.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-white/15 px-2 py-[3px] text-[11px] font-bold">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!!notes.length && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              disabled={!edit}
              onClick={() => onNote(note)}
              aria-label={edit ? `Ubah catatan ${note.title}` : undefined}
              className={cx(
                "flex shrink-0 snap-start flex-col gap-1 rounded-[14px] bg-note-bg p-3 text-left text-ink",
                notes.length === 1 ? "w-full" : "w-[min(78vw,280px)]",
              )}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-note-fg">
                <NotebookPen size={13} aria-hidden="true" />
                {note.title || "Tanpa judul"}
              </span>
              <span className="line-clamp-3 text-[13px] leading-[1.45] whitespace-pre-line">{note.text || "Belum ada isi."}</span>
            </button>
          ))}
        </div>
      )}

      {count > 0 && (
        <div className={cx("grid gap-2", count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {edit && (
            <button type="button" onClick={() => onNote(null)} className={action}>
              <NotebookPen size={18} aria-hidden="true" />
              {notes.length ? "Catatan baru" : "Tulis catatan"}
            </button>
          )}
          {n.url && (
            <a href={n.url} target="_blank" rel="noreferrer" aria-label={`Buka di ${sourceName(n.url)}`} className={action}>
              <ExternalLink size={18} aria-hidden="true" />
              <span className="max-w-full truncate">{sourceName(n.url)}</span>
            </a>
          )}
          {edit && (
            <button type="button" onClick={onDelete} className={cx(action, "text-[#ff9b91]")}>
              <Trash2 size={18} aria-hidden="true" />
              Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Popup konfirmasi hapus ---------- */

function ConfirmDialog({ ref, title, body, action, run, onCancel }: Confirm & { ref: React.Ref<HTMLDivElement>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div ref={ref} className="fixed inset-0 z-[70] flex items-center justify-center p-6" onKeyDown={(e) => e.key === "Escape" && !busy && onCancel()}>
      <div data-backdrop className="absolute inset-0 bg-[#100f18]/60" onClick={() => !busy && onCancel()} />
      <div
        data-panel
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hapus-judul"
        aria-describedby="hapus-isi"
        className="relative flex w-full max-w-[340px] flex-col items-center rounded-[24px] bg-surface p-5 text-center text-ink"
      >
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-[#fdf1ef] text-danger">
          <Trash2 size={22} aria-hidden="true" />
        </span>
        <h2 id="hapus-judul" className="mt-3 text-[18px] leading-[1.3] font-extrabold">
          {title}
        </h2>
        <p id="hapus-isi" className="mt-1.5 text-[14px] text-muted">
          {body} Tidak bisa dibatalkan.
        </p>
        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <Button variant="ground" autoFocus disabled={busy} onClick={onCancel}>
            Batal
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await run();
              setBusy(false);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-danger px-4 text-[13px] font-bold text-white transition-colors duration-150 active:bg-[#8f1c13] disabled:opacity-60"
          >
            {busy ? "Menghapus…" : action}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lembar tambah referensi ---------- */

function AddSheet({
  ref,
  target,
  setTarget,
  boards,
  link,
  setLink,
  onClose,
  onLink,
  onFiles,
}: {
  ref: React.Ref<HTMLDivElement>;
  target: AlbumRef;
  setTarget: (t: AlbumRef) => void;
  boards: { id: MoodBoardId; name: string; albums: Album[] }[];
  link: string;
  setLink: (s: string) => void;
  onClose: () => void;
  onLink: (url: string, to: AlbumRef) => void;
  onFiles: (files: FileList, to: AlbumRef) => void;
}) {
  const albums = boards.find((b) => b.id === target.board)?.albums ?? [];
  // Album tujuan yang sudah tidak ada (frame dihapus di laptop) kembali ke "di luar frame".
  const to = albums.some((a) => a.id === target.id) ? target : { board: target.board, id: LOOSE };
  const [err, setErr] = useState("");
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      const url = text.match(/https?:\/\/\S+/)?.[0];
      if (!url) return setErr("Isi clipboard bukan link. Salin link dari Instagram atau Pinterest dulu.");
      setErr("");
      setLink(url);
    } catch {
      setErr("Browser tidak mengizinkan membaca clipboard. Tekan lama kolom link lalu pilih Tempel.");
    }
  }
  function submit() {
    const url = link.trim().match(/https?:\/\/\S+/)?.[0] ?? "";
    if (!isLink(url)) return setErr("Tempel link yang diawali https://");
    onLink(url, to);
  }

  return (
    <div ref={ref} className="fixed inset-0 z-[60]" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div data-backdrop className="absolute inset-0 bg-[#1c1b29]/45" onClick={onClose} />
      <div
        data-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="tambah-judul"
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[24px] bg-surface px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <SheetGrip onClose={onClose} />
        <div className="flex items-center justify-between">
          <h2 id="tambah-judul" className="text-[18px] font-extrabold">
            Tambah referensi
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-[12px] font-semibold text-muted">Papan</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-ground p-1" role="radiogroup" aria-label="Papan">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={to.board === b.id}
              onClick={() => setTarget({ board: b.id, id: LOOSE })}
              className={cx("h-11 rounded-[10px] text-[13px] font-bold transition-colors duration-150", to.board === b.id ? "bg-surface text-ink" : "text-muted")}
            >
              {b.name}
            </button>
          ))}
        </div>

        {albums.length > 1 && (
          <>
            <p className="mt-4 text-[12px] font-semibold text-muted">Album</p>
            <div className="-mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Album">
              {albums.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={to.id === a.id}
                  onClick={() => setTarget({ board: to.board, id: a.id })}
                  className={cx("h-11 shrink-0 rounded-[10px] px-3 text-[13px] font-bold transition-colors duration-150", to.id === a.id ? "bg-accent text-ink" : "bg-ground text-ink")}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </>
        )}

        <label htmlFor="mood-link" className="mt-5 block text-[12px] font-semibold text-muted">
          Link Instagram, Threads, atau Pinterest
        </label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="mood-link"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.instagram.com/p/…"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {canPaste && (
            <Button variant="ground" onClick={paste} aria-label="Tempel dari clipboard">
              <ClipboardPaste size={16} aria-hidden="true" />
              Tempel
            </Button>
          )}
        </div>
        {err && <p className="mt-1.5 text-[13px] font-semibold text-danger">{err}</p>}
        <Button className="mt-3 w-full" onClick={submit} disabled={!link.trim()}>
          Simpan link
        </Button>

        <div className="my-4 flex items-center gap-3 text-[12px] font-semibold text-muted">
          <span className="h-px flex-1 bg-line" />
          atau
          <span className="h-px flex-1 bg-line" />
        </div>

        <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-bold text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          <Images size={16} aria-hidden="true" />
          Pilih foto dari galeri
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files?.length && onFiles(e.target.files, to)}
          />
        </label>

        <p className="mt-4 rounded-xl bg-sunken p-3 text-[13px] text-muted">
          Dari Instagram di Android: ketuk Bagikan lalu pilih Rukun (setelah Rukun dipasang ke layar utama). Di iPhone: ketuk Salin link, lalu Tempel di sini.
        </p>
      </div>
    </div>
  );
}

/* ---------- Lembar frame baru ---------- */

function FrameSheet({ ref, boardName, onClose, onCreate }: { ref: React.Ref<HTMLDivElement>; boardName: string; onClose: () => void; onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    await onCreate(name);
    setBusy(false);
  }
  return (
    <div ref={ref} className="fixed inset-0 z-[60]" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div data-backdrop className="absolute inset-0 bg-[#1c1b29]/45" onClick={onClose} />
      <div
        data-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="frame-judul"
        className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-surface px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <SheetGrip onClose={onClose} />
        <div className="flex items-center justify-between">
          <h2 id="frame-judul" className="text-[18px] font-extrabold">
            Frame baru di {boardName}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-[14px] text-muted">Frame ini langsung muncul di kanvas laptop, di sebelah kanan isi papan.</p>
        <label htmlFor="frame-nama" className="mt-4 block text-[12px] font-semibold text-muted">
          Nama frame
        </label>
        <Input
          id="frame-nama"
          className="mt-1.5"
          autoFocus
          maxLength={120}
          placeholder="Contoh: Pelaminan"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button className="mt-3 w-full" onClick={submit} disabled={!title.trim() || busy}>
          {busy ? "Menyimpan…" : "Buat frame"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Lembar catatan foto ---------- */

function NoteSheet({
  ref,
  note,
  onClose,
  onSave,
  onDelete,
}: {
  ref: React.Ref<HTMLDivElement>;
  note: MoodNode | null;
  onClose: () => void;
  onSave: (title: string, text: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "Catatan");
  const [text, setText] = useState(note?.text ?? "");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    await fn();
    setBusy(false);
  }
  return (
    <div ref={ref} className="fixed inset-0 z-[60]" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div data-backdrop className="absolute inset-0 bg-[#1c1b29]/45" onClick={onClose} />
      <div
        data-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="catatan-judul"
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[24px] bg-surface px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <SheetGrip onClose={onClose} />
        <div className="flex items-center justify-between">
          <h2 id="catatan-judul" className="text-[18px] font-extrabold">
            {note ? "Ubah catatan" : "Catatan untuk foto ini"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {!note && <p className="mt-1 text-[14px] text-muted">Catatan muncul di papan laptop di samping foto, tersambung dengan garis.</p>}
        <label htmlFor="catatan-nama" className="mt-4 block text-[12px] font-semibold text-muted">
          Judul
        </label>
        <Input id="catatan-nama" className="mt-1.5" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="catatan-isi" className="mt-3 block text-[12px] font-semibold text-muted">
          Isi catatan
        </label>
        <Textarea
          id="catatan-isi"
          className="mt-1.5 min-h-32"
          autoFocus
          maxLength={MOOD_LIMITS.text}
          placeholder="Contoh: warna bunga seperti ini, tapi pelaminannya lebih sederhana"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button className="mt-3 w-full" disabled={!text.trim() || busy} onClick={() => run(() => onSave(title.trim() || "Catatan", text.trim()))}>
          {busy ? "Menyimpan…" : "Simpan catatan"}
        </Button>
        {note && (
          <Button variant="ghost" className="mt-2 w-full text-danger" disabled={busy} onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            Hapus catatan
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Pegangan lembar bawah: tarik ke bawah untuk menutup ---------- */

function SheetGrip({ onClose }: { onClose: () => void }) {
  const start = useRef<{ y: number; t: number } | null>(null);
  const panel = (el: HTMLElement) => el.closest<HTMLElement>("[data-panel]");
  function end(e: React.PointerEvent<HTMLDivElement>) {
    const s0 = start.current;
    if (!s0) return;
    start.current = null;
    const dy = Math.max(0, e.clientY - s0.y);
    const fast = dy / Math.max(1, performance.now() - s0.t) > 0.5;
    if (dy > 90 || (fast && dy > 24)) onClose();
    else gsap.to(panel(e.currentTarget), { y: 0, duration: t(0.3), ease: EASE });
  }
  return (
    <div
      aria-hidden="true"
      className="-mx-4 -mt-2 mb-1 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      onPointerDown={(e) => {
        start.current = { y: e.clientY, t: performance.now() };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current) gsap.set(panel(e.currentTarget), { y: Math.max(0, e.clientY - start.current.y) });
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="block h-1 w-10 rounded-full bg-nav" />
    </div>
  );
}
