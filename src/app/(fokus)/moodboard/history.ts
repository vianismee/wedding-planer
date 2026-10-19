import type { MoodData } from "@/db/schema";
import { invertOps, type MoodOp } from "@/lib/moodboard";

// Undo dan redo hanya untuk perubahan sendiri, per papan (seperti Figma): membatalkan langkah kita
// tidak ikut membatalkan perubahan anggota lain di elemen lain.
type Entry = { do: MoodOp[]; undo: MoodOp[]; key?: string; t: number };
export type History = Record<string, { past: Entry[]; future: Entry[] }>;

const LIMIT = 100;
// Ketikan beruntun di isian yang sama digabung jadi satu langkah undo.
const MERGE_MS = 1200;

export function record(h: History, board: string, before: MoodData, ops: MoodOp[], key?: string) {
  const s = (h[board] ??= { past: [], future: [] });
  const undo = invertOps(before, ops);
  const last = s.past.at(-1);
  const now = Date.now();
  if (key && last?.key === key && now - last.t < MERGE_MS) {
    last.do = [...last.do, ...ops];
    last.undo = [...undo, ...last.undo];
    last.t = now;
  } else {
    s.past.push({ do: ops, undo, key, t: now });
    if (s.past.length > LIMIT) s.past.shift();
  }
  s.future = [];
}

/** Ambil operasi untuk undo (atau redo), dan pindahkan langkahnya ke tumpukan sebaliknya. */
export function step(h: History, board: string, dir: "undo" | "redo"): MoodOp[] | null {
  const s = h[board];
  const e = dir === "undo" ? s?.past.pop() : s?.future.pop();
  if (!s || !e) return null;
  e.key = undefined;
  (dir === "undo" ? s.future : s.past).push(e);
  return dir === "undo" ? e.undo : e.do;
}
