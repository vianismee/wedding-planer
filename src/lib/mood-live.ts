import "server-only";
import { publishRoom, subscribeRoom } from "./live";
import type { MoodEvent, MoodPresence } from "./moodboard";

// Siapa yang sedang membuka moodboard, per ruang pernikahan. Hanya di memori: kursor tidak perlu
// disimpan, dan arsitektur 1 VPS berarti semua tab tersambung ke proses yang sama.
type State = { rooms: Map<string, Map<string, MoodPresence>>; sweep?: ReturnType<typeof setInterval> };
const g = globalThis as unknown as { __rukunMood?: State };
const state: State = (g.__rukunMood ??= { rooms: new Map() });

const room = (weddingId: string) => `mood:${weddingId}`;

export function emitMood(weddingId: string, e: MoodEvent) {
  publishRoom(room(weddingId), e);
}

export function subscribeMood(weddingId: string, fn: (e: MoodEvent) => void) {
  return subscribeRoom(room(weddingId), fn as (p: unknown) => void);
}

export function setPresence(weddingId: string, p: MoodPresence) {
  let r = state.rooms.get(weddingId);
  if (!r) state.rooms.set(weddingId, (r = new Map()));
  r.set(p.clientId, p);
  emitMood(weddingId, { type: "presence", p });
}

export function leave(weddingId: string, clientId: string) {
  const r = state.rooms.get(weddingId);
  if (!r?.delete(clientId)) return;
  if (!r.size) state.rooms.delete(weddingId);
  emitMood(weddingId, { type: "leave", clientId });
}

export function snapshot(weddingId: string) {
  return [...(state.rooms.get(weddingId)?.values() ?? [])];
}

// Tab yang tertutup tanpa sempat memutus koneksi (HP tidur, jaringan hilang) dibersihkan di sini.
// Klien mengirim detak tiap 10 detik walau diam.
state.sweep ??= setInterval(() => {
  const old = Date.now() - 25_000;
  for (const [w, r] of state.rooms) for (const p of r.values()) if (p.t < old) leave(w, p.clientId);
}, 5_000);
