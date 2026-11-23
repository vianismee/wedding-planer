import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, preflight } from "@/lib/api";

export const OPTIONS = preflight;

/** Ucapan dan doa dari RSVP, terbaru dulu. Query: page, limit (maks 100). */
export const GET = handler("any", async ({ weddingId, req }) => {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const g = schema.guest;
  const cond = and(eq(g.weddingId, weddingId), isNotNull(g.rsvpMessage));
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(g).where(cond),
    db
      .select({ name: g.name, message: g.rsvpMessage, attendance: g.rsvp, at: g.rsvpAt })
      .from(g)
      .where(cond)
      .orderBy(desc(g.rsvpAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return Response.json({
    data: rows.map((r) => ({ ...r, at: r.at?.toISOString() ?? null })),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});
