import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { body, handler, preflight } from "@/lib/api";
import { createGuest, fullGuest, invitationPattern } from "@/lib/api-guest";

export const OPTIONS = preflight;

const g = schema.guest;

/** Daftar tamu dengan filter dan halaman. Query: q, side, category, session, status, rsvp, page, limit. */
export const GET = handler("server", async ({ weddingId, req }) => {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100));
  const where: SQL[] = [eq(g.weddingId, weddingId)];
  const q = sp.get("q")?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(g.name, like), ilike(g.note, like), ilike(g.phone, like), ilike(g.instagram, like), ilike(g.code, like))!);
  }
  for (const k of ["side", "category", "session", "status", "rsvp"] as const) {
    const v = sp.get(k);
    if (v) where.push(eq(g[k], v));
  }
  const cond = and(...where);
  const [[{ total }], rows, pattern] = await Promise.all([
    db.select({ total: count() }).from(g).where(cond),
    db.select().from(g).where(cond).orderBy(asc(g.name), asc(g.id)).limit(limit).offset((page - 1) * limit),
    invitationPattern(weddingId),
  ]);
  return Response.json({
    data: rows.map((r) => fullGuest(r, pattern)),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

/** Tambah satu tamu. */
export const POST = handler("server", async ({ weddingId, req }) => {
  const input = createGuest.parse(await body(req));
  const [row] = await db.insert(g).values({ ...input, weddingId, createdBy: "api" }).returning();
  return Response.json({ data: fullGuest(row, await invitationPattern(weddingId)) }, { status: 201 });
});
