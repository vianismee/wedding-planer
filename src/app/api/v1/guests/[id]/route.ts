import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, body, handler, notFound, preflight } from "@/lib/api";
import { fullGuest, invitationPattern, updateGuest } from "@/lib/api-guest";

export const OPTIONS = preflight;

const g = schema.guest;
type P = { id: string };

/** `id` boleh berupa id tamu atau kode undangannya. */
const match = (weddingId: string, id: string) => and(eq(g.weddingId, weddingId), or(eq(g.id, id), eq(g.code, id.toLowerCase())));

export const GET = handler<P>("server", async ({ weddingId }, { id }) => {
  const [row] = await db.select().from(g).where(match(weddingId, id));
  if (!row) throw notFound();
  return fullGuest(row, await invitationPattern(weddingId));
});

/** Ubah sebagian kolom. Kolom yang tidak dikirim tidak berubah; kirim null untuk mengosongkan. */
export const PATCH = handler<P>("server", async ({ weddingId, req }, { id }) => {
  const input = updateGuest.parse(await body(req));
  if (Object.keys(input).length === 0) throw new ApiError(422, "validation_error", "Tidak ada kolom yang diubah.");
  const [row] = await db.update(g).set(input).where(match(weddingId, id)).returning();
  if (!row) throw notFound();
  return fullGuest(row, await invitationPattern(weddingId));
});

export const DELETE = handler<P>("server", async ({ weddingId }, { id }) => {
  const [row] = await db.delete(g).where(match(weddingId, id)).returning({ id: g.id });
  if (!row) throw notFound();
  return new Response(null, { status: 204 });
});
