// Geometri pena: penyederhanaan goresan, path halus, dan jarak titik ke goresan (untuk penghapus).
// Titik disimpan datar: [x0, y0, x1, y1, ...].

/** Ramer-Douglas-Peucker: buang titik yang hampir segaris supaya goresan kecil disimpan. */
export function simplify(p: number[], eps: number): number[] {
  const n = p.length / 2;
  if (n < 3) return p;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(p[i * 2], p[i * 2 + 1], p[a * 2], p[a * 2 + 1], p[b * 2], p[b * 2 + 1]);
      if (d > max) {
        max = d;
        at = i;
      }
    }
    if (max > eps && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

/** Path SVG halus: kurva kuadratik lewat titik tengah tiap pasang titik. */
export function smoothPath(p: number[]): string {
  const n = p.length / 2;
  if (n === 0) return "";
  if (n === 1) return `M${p[0]} ${p[1]}l0.01 0`;
  if (n === 2) return `M${p[0]} ${p[1]}L${p[2]} ${p[3]}`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (p[i * 2] + p[i * 2 + 2]) / 2;
    const my = (p[i * 2 + 1] + p[i * 2 + 3]) / 2;
    d += `Q${p[i * 2]} ${p[i * 2 + 1]} ${mx} ${my}`;
  }
  return d + `L${p[n * 2 - 2]} ${p[n * 2 - 1]}`;
}

/** Jarak titik (x, y) ke ruas garis (ax, ay)-(bx, by). */
export function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Jarak terdekat titik ke polyline `p` yang ditarik dari kotak vw x vh ke kotak (ox, oy, w, h). */
export function polyDist(x: number, y: number, p: number[], ox: number, oy: number, sx: number, sy: number) {
  const n = p.length / 2;
  if (n === 1) return Math.hypot(x - (ox + p[0] * sx), y - (oy + p[1] * sy));
  let best = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const j = i * 2;
    best = Math.min(best, segDist(x, y, ox + p[j] * sx, oy + p[j + 1] * sy, ox + p[j + 2] * sx, oy + p[j + 3] * sy));
  }
  return best;
}

/**
 * Ubah titik dunia menjadi elemen: kotak pembatas diberi ruang selebar garis supaya goresan lurus
 * (tinggi atau lebar nol) tetap punya kotak yang bisa dipilih dan di-resize.
 */
export function toLocal(world: number[], pad: number) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < world.length; i += 2) {
    x0 = Math.min(x0, world[i]);
    x1 = Math.max(x1, world[i]);
    y0 = Math.min(y0, world[i + 1]);
    y1 = Math.max(y1, world[i + 1]);
  }
  const x = Math.floor(x0 - pad);
  const y = Math.floor(y0 - pad);
  const w = Math.ceil(x1 + pad) - x;
  const h = Math.ceil(y1 + pad) - y;
  const points = world.map((v, i) => Math.round((v - (i % 2 ? y : x)) * 10) / 10);
  return { x, y, w, h, vw: w, vh: h, points };
}
