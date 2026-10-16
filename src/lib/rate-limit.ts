// Rate limit sederhana di memori proses. Cukup untuk satu VPS (lihat PRD: satu monolit).
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return true;
  }
  h.count++;
  return h.count <= max;
}
