import "server-only";
import { EventEmitter } from "node:events";

// Satu emitter untuk satu proses app (arsitektur 1 VPS). Disimpan di globalThis supaya
// server action dan route handler di dev memakai instance yang sama.
const g = globalThis as unknown as { __rukunLive?: EventEmitter };
const live = (g.__rukunLive ??= new EventEmitter().setMaxListeners(0));

/** Beri tahu semua tab yang membuka ruang pernikahan ini bahwa datanya berubah. */
export function publish(weddingId: string) {
  live.emit(weddingId);
}

export function subscribe(weddingId: string, fn: () => void) {
  live.on(weddingId, fn);
  return () => void live.off(weddingId, fn);
}
