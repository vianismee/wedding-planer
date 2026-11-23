import { and, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, notFound, preflight } from "@/lib/api";
import { byCode } from "@/lib/api-guest";

export const OPTIONS = preflight;

/** Catat bahwa tamu sudah membuka undangannya. Hanya pembukaan pertama yang disimpan. */
export const POST = handler<{ code: string }>("any", async ({ weddingId }, { code }) => {
  const where = byCode(weddingId, code);
  const [row] = await db.select({ openedAt: schema.guest.openedAt }).from(schema.guest).where(where);
  if (!row) throw notFound("Undangan");
  if (row.openedAt) return { openedAt: row.openedAt.toISOString(), first: false };
  const now = new Date();
  await db.update(schema.guest).set({ openedAt: now }).where(and(where, isNull(schema.guest.openedAt)));
  return { openedAt: now.toISOString(), first: true };
});
