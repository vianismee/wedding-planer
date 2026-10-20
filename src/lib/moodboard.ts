// Konstanta dan logika moodboard yang dipakai server (validasi, simpan) dan klien (kanvas).
import type { MoodData, MoodEdge, MoodGroup, MoodNode } from "@/db/schema";

export const MOOD_BOARDS = [
  { id: "utama", name: "Konsep utama" },
  { id: "akad", name: "Akad" },
  { id: "resepsi", name: "Resepsi" },
] as const;
export type MoodBoardId = (typeof MOOD_BOARDS)[number]["id"];

// Tag bawaan hanya saran. Anggota bisa menambah tag sendiri dari panel detail kartu.
export const MOOD_TAGS = ["Dekor", "Pelaminan", "Busana", "Warna", "Bunga", "Makanan", "Suvenir"];
export const MOOD_TAG_MAX = 30;

// Warna latar kelompok memakai pasangan warna status DESIGN.md supaya tetap dalam palet.
export const MOOD_GROUP_COLORS: Record<string, { bg: string; line: string; name: string }> = {
  netral: { bg: "rgba(255, 255, 255, 0.6)", line: "#d9d8e4", name: "Netral" },
  krem: { bg: "rgba(251, 240, 217, 0.7)", line: "#ebddba", name: "Krem" },
  lavender: { bg: "rgba(231, 228, 251, 0.7)", line: "#cfc9f2", name: "Lavender" },
  hijau: { bg: "rgba(238, 247, 204, 0.75)", line: "#d5e6a0", name: "Hijau" },
  peach: { bg: "rgba(252, 229, 216, 0.7)", line: "#f0c9b3", name: "Peach" },
};

export const MOOD_LIMITS = { nodes: 300, edges: 600, groups: 40, swatches: 6, tags: 12, points: 2000, text: 5000, media: 20 };

/** Nama sumber link untuk label kartu media: "Instagram", "Pinterest", atau nama domain. */
export function sourceName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/(^|\.)instagram\.com$/.test(host)) return "Instagram";
    if (/(^|\.)pinterest\.[a-z.]+$/.test(host) || host === "pin.it") return "Pinterest";
    if (/(^|\.)tiktok\.com$/.test(host)) return "TikTok";
    return host;
  } catch {
    return "Link";
  }
}

// Font untuk teks di kanvas. Variabel CSS dipasang oleh src/lib/mood-fonts.ts; Plus Jakarta Sans
// sudah dimuat di root layout. Skrip tulisan tangan ada karena moodboard dipakai untuk mencoba
// gaya tulisan undangan dan papan nama, bukan untuk antarmuka aplikasi.
export const MOOD_FONTS = {
  sans: { name: "Plus Jakarta Sans", css: "var(--font-jakarta), system-ui, sans-serif" },
  playfair: { name: "Playfair Display", css: "var(--font-playfair), Georgia, serif" },
  cormorant: { name: "Cormorant Garamond", css: "var(--font-cormorant), Georgia, serif" },
  caveat: { name: "Caveat", css: "var(--font-caveat), cursive" },
  dancing: { name: "Dancing Script", css: "var(--font-dancing), cursive" },
  vibes: { name: "Great Vibes", css: "var(--font-vibes), cursive" },
} as const;
export type MoodFont = keyof typeof MOOD_FONTS;

// Warna cepat untuk pena, garis, dan teks: ink, muted, dan warna teks status dari DESIGN.md.
export const MOOD_INK = ["#1c1b29", "#5e5d70", "#3b2f8f", "#8a3b12", "#3d5a0c", "#b42318"];
// Isi bentuk: latar status DESIGN.md dan putih.
export const MOOD_FILLS = ["#ffffff", "#eef7cc", "#e7e4fb", "#fce5d8", "#fbf0d9"];

// Warna kursor anggota lain. Semuanya lolos kontras 4,5:1 untuk label nama berwarna putih.
export const PRESENCE_COLORS = ["#3b2f8f", "#8a3b12", "#3d5a0c", "#b42318", "#0b5a6b", "#6b4a12"];
export function presenceColor(userId: string) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

/* ---------- Operasi ---------- */

export type MoodColl = "nodes" | "edges" | "groups";
type Item = MoodNode | MoodEdge | MoodGroup;

/**
 * Perubahan papan dikirim sebagai operasi per elemen, bukan isi papan utuh, supaya beberapa anggota
 * bisa mengedit bersamaan. `put` menaruh elemen utuh (elemen baru, undo hapus); `patch` hanya mengubah
 * atribut yang disebut, jadi dua orang yang mengubah atribut berbeda di elemen yang sama tidak saling
 * menimpa. Atribut yang sama diubah dua orang: yang terakhir sampai di server yang dipakai.
 * Di `patch`, nilai null berarti atribut dihapus.
 */
export type MoodOp =
  | { t: "put"; c: "nodes"; item: MoodNode }
  | { t: "put"; c: "edges"; item: MoodEdge }
  | { t: "put"; c: "groups"; item: MoodGroup }
  | { t: "patch"; c: MoodColl; id: string; set: Record<string, unknown> }
  | { t: "del"; c: MoodColl; id: string }
  | { t: "front"; id: string };

export const EMPTY_BOARD: MoodData = { nodes: [], edges: [], groups: [] };

/** Ubah objek atribut menjadi isi `patch`: undefined (atribut dikosongkan) dikirim sebagai null. */
export function toSet(patch: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]));
}

/** Terapkan operasi ke papan tanpa mengubah papan asal. Elemen baru ditaruh paling atas. */
export function applyOps(d: MoodData, ops: MoodOp[]): MoodData {
  let out = d;
  for (const op of ops) {
    if (op.t === "put") {
      const list = out[op.c] as Item[];
      const i = list.findIndex((x) => x.id === op.item.id);
      const next = i < 0 ? [...list, op.item] : list.map((x, j) => (j === i ? op.item : x));
      out = { ...out, [op.c]: next };
    } else if (op.t === "patch") {
      // Elemen sudah dihapus anggota lain: perubahan atributnya diabaikan.
      const list = out[op.c] as Item[];
      const i = list.findIndex((x) => x.id === op.id);
      if (i < 0) continue;
      const next: Record<string, unknown> = { ...list[i] };
      for (const [k, v] of Object.entries(op.set)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      out = { ...out, [op.c]: list.map((x, j) => (j === i ? next : x)) };
    } else if (op.t === "del") {
      out = { ...out, [op.c]: (out[op.c] as Item[]).filter((x) => x.id !== op.id) };
      if (op.c === "nodes") out = { ...out, edges: out.edges.filter((e) => e.from !== op.id && e.to !== op.id) };
    } else {
      const n = out.nodes.find((x) => x.id === op.id);
      if (n && out.nodes.at(-1)?.id !== op.id) out = { ...out, nodes: [...out.nodes.filter((x) => x.id !== op.id), n] };
    }
  }
  return out;
}

/** Operasi kebalikan untuk undo, dihitung dari isi papan sebelum `ops` diterapkan. */
export function invertOps(d: MoodData, ops: MoodOp[]): MoodOp[] {
  const steps: MoodOp[][] = [];
  let cur = d;
  for (const op of ops) {
    const step: MoodOp[] = [];
    if (op.t === "put") {
      const old = (cur[op.c] as Item[]).find((x) => x.id === op.item.id);
      step.push(old ? ({ t: "put", c: op.c, item: old } as MoodOp) : { t: "del", c: op.c, id: op.item.id });
    } else if (op.t === "patch") {
      const old = (cur[op.c] as Item[]).find((x) => x.id === op.id) as Record<string, unknown> | undefined;
      if (old) step.push({ t: "patch", c: op.c, id: op.id, set: Object.fromEntries(Object.keys(op.set).map((k) => [k, old[k] ?? null])) });
    } else if (op.t === "del") {
      const old = (cur[op.c] as Item[]).find((x) => x.id === op.id);
      if (old) {
        step.push({ t: "put", c: op.c, item: old } as MoodOp);
        // Sambungan ikut terhapus bersama kartunya, jadi ikut dikembalikan setelah kartunya ada lagi.
        if (op.c === "nodes") for (const e of cur.edges) if (e.from === op.id || e.to === op.id) step.push({ t: "put", c: "edges", item: e });
      }
    }
    steps.push(step);
    cur = applyOps(cur, [op]);
  }
  return steps.reverse().flat();
}

/* ---------- Kehadiran (kursor anggota lain) ---------- */

export type MoodRect = { x: number; y: number; w: number; h: number };
// Posisi sementara elemen yang sedang digeser atau di-resize, belum tersimpan.
export type MoodMoving = Record<string, { x: number; y: number; w?: number; h?: number }>;

export type MoodPresence = {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  board: string;
  // Koordinat papan, bukan layar, supaya tetap tepat di zoom yang berbeda.
  cursor: { x: number; y: number } | null;
  sel: string[];
  view: MoodRect | null;
  moving: MoodMoving | null;
  t: number;
};

export type MoodEvent =
  | { type: "snapshot"; presence: MoodPresence[] }
  | { type: "presence"; p: MoodPresence }
  | { type: "leave"; clientId: string }
  | { type: "ops"; board: string; rev: number; clientId: string; ops: MoodOp[] };
