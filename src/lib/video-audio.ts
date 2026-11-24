"use client";

import { useEffect, useState } from "react";

// Apakah video MP4 punya trek audio. Instagram kadang mengirim video tanpa suara ke server (misalnya musik
// berlisensi yang tidak tersedia di negara server), jadi kartu video perlu penanda. Yang dibaca hanya header
// MP4 lewat Range request, bukan seluruh video, dan hasilnya disimpan per sesi.

const MAX_MOOV = 4 * 1024 * 1024;
const cache = new Map<string, Promise<boolean | null>>();

async function range(src: string, start: number, end: number) {
  const res = await fetch(src, { headers: { Range: `bytes=${start}-${end}` } });
  // Tanpa dukungan Range server mengirim seluruh file: jangan baca video utuh hanya untuk penanda.
  if (res.status !== 206) {
    await res.body?.cancel();
    return null;
  }
  return new Uint8Array(await res.arrayBuffer());
}

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const tag = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** Handler trek di dalam atom moov: kotak `hdlr` menyimpan jenisnya 8 byte setelah nama kotak + versi. */
function handlers(moov: Uint8Array) {
  const out: string[] = [];
  for (let i = 4; i + 16 <= moov.length; i++)
    if (moov[i] === 0x68 && tag(moov, i) === "hdlr") out.push(tag(moov, i + 12));
  return out;
}

/** true: ada audio, false: hanya video, null: tidak bisa diketahui (bukan MP4, atau server tanpa Range). */
async function probe(src: string): Promise<boolean | null> {
  let pos = 0;
  // Telusuri atom tingkat atas sampai ketemu moov (di depan untuk file "faststart", bisa juga di belakang).
  for (let hop = 0; hop < 12; hop++) {
    const head = await range(src, pos, pos + 15);
    if (!head || head.length < 8) return null;
    let size = u32(head, 0);
    const kind = tag(head, 4);
    let hdr = 8;
    if (size === 1 && head.length >= 16) {
      size = u32(head, 8) * 2 ** 32 + u32(head, 12);
      hdr = 16;
    }
    if (hop === 0 && kind !== "ftyp") return null;
    if (kind === "moov") {
      if (size > MAX_MOOV) return null;
      const moov = await range(src, pos + hdr, pos + size - 1);
      if (!moov) return null;
      const h = handlers(moov);
      return h.includes("vide") || h.includes("soun") ? h.includes("soun") : null;
    }
    if (size < hdr) return null;
    pos += size;
  }
  return null;
}

export function videoHasAudio(src: string) {
  let p = cache.get(src);
  if (!p) {
    p = probe(src).catch(() => null);
    cache.set(src, p);
  }
  return p;
}

/** Hook: true bila video pasti tanpa trek audio. Selama belum diketahui, dianggap bersuara (tanpa penanda). */
export function useSilentVideo(src: string | null) {
  const [silent, setSilent] = useState<{ src: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    void videoHasAudio(src).then((audio) => live && setSilent({ src, value: audio === false }));
    return () => {
      live = false;
    };
  }, [src]);
  return !!src && silent?.src === src && silent.value;
}
