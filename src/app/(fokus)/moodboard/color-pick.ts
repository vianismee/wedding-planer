// Pipet moodboard: membaca warna di satu titik layar dari isi kartu di kanvas. Foto dan video dibaca
// pikselnya (semuanya dari server sendiri, jadi kanvas tidak "tercemar" CORS); elemen lain memakai
// warna latarnya. Tidak memakai EyeDropper bawaan browser karena belum ada di Safari dan Firefox.

const contains = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

let probe: CanvasRenderingContext2D | null = null;
const getProbe = () => (probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true }));

/**
 * Warna CSS apa pun (rgb, oklch, nama warna) menjadi #hex lewat satu piksel kanvas, karena
 * getComputedStyle bisa mengembalikan format selain rgb. Null bila transparan.
 */
function cssToHex(css: string) {
  const ctx = getProbe();
  if (!ctx || !css || css === "transparent") return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a ? toHex(r, g, b) : null;
}

/** Piksel foto atau video di titik layar, mengikuti object-fit dan object-position yang sedang dipakai. */
function mediaPixel(el: HTMLImageElement | HTMLVideoElement, x: number, y: number) {
  const nw = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
  const nh = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
  if (!nw || !nh) return null;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const scale = st.objectFit === "cover" ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
  const [px, py] = st.objectPosition.split(" ").map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : 0.5));
  const ix = (x - r.left - (r.width - nw * scale) * px) / scale;
  const iy = (y - r.top - (r.height - nh * scale) * (py ?? 0.5)) / scale;
  // Di luar gambar (sisa latar pada mode "Utuh"): biarkan pemanggil memakai warna latarnya.
  if (ix < 0 || iy < 0 || ix >= nw || iy >= nh) return null;
  const ctx = getProbe();
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(el, Math.floor(ix), Math.floor(iy), 1, 1, 0, 0, 1, 1);
    const [r2, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a ? toHex(r2, g, b) : null;
  } catch {
    return null;
  }
}

/**
 * Warna di titik layar (x, y) di dalam elemen kartu `root`. Foto atau video yang tampil di titik itu
 * lebih dulu, lalu latar terdalam yang tidak transparan (misalnya warna di kartu palet).
 */
export function sampleColor(root: HTMLElement, x: number, y: number): string | null {
  const media = [...root.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")]
    .reverse()
    .find((el) => contains(el.getBoundingClientRect(), x, y) && (el instanceof HTMLVideoElement || el.complete));
  if (media) {
    const c = mediaPixel(media, x, y);
    if (c) return c;
  }
  let found: string | null = null;
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    if (!(el instanceof HTMLElement) || !contains(el.getBoundingClientRect(), x, y)) continue;
    const c = cssToHex(getComputedStyle(el).backgroundColor);
    if (c) found = c;
  }
  return found;
}
