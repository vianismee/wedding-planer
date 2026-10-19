"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MoodData } from "@/db/schema";
import { applyOps, type MoodEvent, type MoodMoving, type MoodOp, type MoodPresence, type MoodRect } from "@/lib/moodboard";

export type SyncState = "saved" | "saving" | "error" | "offline";
type Mine = { board: string; cursor: { x: number; y: number } | null; sel: string[]; view: MoodRect | null; moving: MoodMoving | null };

/**
 * Sinkron papan dengan server dan anggota lain.
 *
 * `server` adalah isi papan yang sudah dikonfirmasi server pada revisi `rev`. Operasi lokal yang belum
 * dikonfirmasi ada di `pending` dan selalu diterapkan ulang di atas `server`, jadi perubahan anggota
 * lain bisa masuk tanpa menimpa kerja yang belum tersimpan. Operasi dari server diterapkan berurutan
 * menurut revisi; bila ada revisi yang terlewat, isi papan diambil ulang.
 */
export function useMoodSync(initial: Record<string, MoodData>, initialRev: Record<string, number>, onError: (msg: string) => void) {
  const [clientId] = useState(() => crypto.randomUUID());
  const [boards, setBoards] = useState(initial);
  const [state, setState] = useState<SyncState>("saved");
  const [peers, setPeers] = useState<Record<string, MoodPresence>>({});

  const server = useRef<Record<string, MoodData>>({ ...initial });
  const rev = useRef<Record<string, number>>({ ...initialRev });
  const pending = useRef<Record<string, MoodOp[]>>({});
  const inflight = useRef<Record<string, number>>({});
  const buffer = useRef<Record<string, Map<number, MoodOp[]>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const refresh = useCallback((b: string) => {
    setBoards((prev) => ({ ...prev, [b]: applyOps(server.current[b], pending.current[b] ?? []) }));
  }, []);

  const updateState = useCallback(() => {
    const busy = Object.values(pending.current).some((p) => p.length);
    setState((s) => (s === "error" || s === "offline" ? (busy ? s : "saved") : busy ? "saving" : "saved"));
  }, []);

  const resync = useCallback(async () => {
    try {
      const res = await fetch("/api/moodboard/ops", { cache: "no-store" });
      if (!res.ok) return;
      const { boards: fresh } = (await res.json()) as { boards: Record<string, { data: MoodData; rev: number }> };
      for (const [b, v] of Object.entries(fresh)) {
        if (v.rev < (rev.current[b] ?? 0)) continue;
        server.current[b] = v.data;
        rev.current[b] = v.rev;
        const buf = buffer.current[b];
        if (buf) for (const r of [...buf.keys()]) if (r <= v.rev) buf.delete(r);
        drain(b);
      }
    } catch {
      // Jaringan putus: EventSource akan tersambung ulang dan memanggil resync lagi.
    }
    // drain dideklarasikan di bawah sebagai fungsi biasa; aman dipanggil di sini karena hanya membaca ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drain(b: string) {
    const buf = (buffer.current[b] ??= new Map());
    let r = (rev.current[b] ?? 0) + 1;
    while (buf.has(r)) {
      server.current[b] = applyOps(server.current[b], buf.get(r)!);
      buf.delete(r);
      rev.current[b] = r++;
    }
    refresh(b);
    if (gapTimer.current) clearTimeout(gapTimer.current);
    // Ada revisi lebih baru tapi yang di antaranya belum sampai: tunggu sebentar, lalu ambil ulang.
    if (buf.size) gapTimer.current = setTimeout(resync, 1500);
  }

  async function flush(b: string) {
    const list = pending.current[b] ?? [];
    if (inflight.current[b] || !list.length) return;
    const n = list.length;
    inflight.current[b] = n;
    let retry = false;
    try {
      const res = await fetch("/api/moodboard/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: b, clientId, ops: list.slice(0, n) }),
      });
      if (res.ok) {
        const { rev: r } = (await res.json()) as { rev: number };
        if (r > (rev.current[b] ?? 0)) (buffer.current[b] ??= new Map()).set(r, list.slice(0, n));
        pending.current[b] = pending.current[b].slice(n);
        failed.current = 0;
        setState((s) => (s === "offline" ? "saving" : s));
        drain(b);
      } else if (res.status >= 500) {
        retry = true;
      } else {
        // Ditolak server (batas papan, sesi habis): batalkan perubahan itu supaya papan tetap sama dengan server.
        const data = await res.json().catch(() => ({}));
        pending.current[b] = pending.current[b].slice(n);
        refresh(b);
        setState("error");
        onErrorRef.current(data.error ?? (res.status === 401 ? "Sesi berakhir. Masuk lagi untuk menyimpan." : "Perubahan tidak tersimpan."));
      }
    } catch {
      retry = true;
    } finally {
      inflight.current[b] = 0;
    }
    if (retry) {
      // Operasi aman dikirim ulang: menaruh atau menghapus elemen yang sama dua kali hasilnya sama.
      failed.current++;
      setState("offline");
      timers.current[b] = setTimeout(() => flush(b), Math.min(10_000, 1000 * 2 ** Math.min(failed.current, 4)));
      return;
    }
    if (pending.current[b]?.length) schedule(b);
    else updateState();
  }

  function schedule(b: string, ms = 120) {
    clearTimeout(timers.current[b]);
    timers.current[b] = setTimeout(() => flush(b), ms);
  }

  /** Terapkan operasi di tab ini sekarang, kirim ke server sebentar lagi (beberapa perubahan dikirim sekaligus). */
  const commit = (b: string, ops: MoodOp[]) => {
    if (!ops.length) return;
    (pending.current[b] ??= []).push(...ops);
    refresh(b);
    setState((s) => (s === "offline" ? s : "saving"));
    schedule(b);
  };

  /* ---------- Aliran dari server ---------- */

  useEffect(() => {
    const es = new EventSource(`/api/moodboard/live?client=${clientId}`);
    // Setiap kali tersambung (termasuk pertama kali) mungkin ada perubahan yang terlewat sejak halaman dimuat.
    es.onopen = () => void resync();
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as MoodEvent;
      if (e.type === "snapshot") setPeers(Object.fromEntries(e.presence.filter((p) => p.clientId !== clientId).map((p) => [p.clientId, p])));
      else if (e.type === "presence") {
        if (e.p.clientId !== clientId) setPeers((prev) => ({ ...prev, [e.p.clientId]: e.p }));
      } else if (e.type === "leave") {
        setPeers((prev) => {
          if (!prev[e.clientId]) return prev;
          const next = { ...prev };
          delete next[e.clientId];
          return next;
        });
      } else if (e.type === "ops" && e.clientId !== clientId && e.rev > (rev.current[e.board] ?? 0)) {
        (buffer.current[e.board] ??= new Map()).set(e.rev, e.ops);
        drain(e.board);
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, resync]);

  // Peringatkan sebelum menutup tab bila masih ada perubahan yang belum tersimpan.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (Object.values(pending.current).some((p) => p.length)) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  /* ---------- Kehadiran: kursor, pilihan, tampilan ---------- */

  const mine = useRef<Mine | null>(null);
  const lastSent = useRef(0);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendNow = useCallback(() => {
    if (!mine.current) return;
    lastSent.current = Date.now();
    fetch("/api/moodboard/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, ...mine.current }),
      keepalive: true,
    }).catch(() => {});
  }, [clientId]);

  /** Kirim kursor dan pilihan paling cepat tiap 50 ms; perubahan terakhir selalu terkirim. */
  const presence = useCallback(
    (patch: Partial<Mine> & { board: string }) => {
      mine.current = { cursor: null, sel: [], view: null, moving: null, ...mine.current, ...patch };
      if (presenceTimer.current) return;
      const wait = Math.max(0, 50 - (Date.now() - lastSent.current));
      presenceTimer.current = setTimeout(() => {
        presenceTimer.current = null;
        sendNow();
      }, wait);
    },
    [sendNow],
  );

  // Detak supaya anggota lain tetap melihat kita walau sedang diam (server menghapus yang diam 25 detik).
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastSent.current > 9_000) sendNow();
    }, 10_000);
    return () => clearInterval(t);
  }, [sendNow]);

  return { clientId, boards, commit, state, peers, presence };
}
