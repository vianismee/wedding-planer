import { db, schema } from "@/db";
import { handler, notFound, preflight } from "@/lib/api";
import { byCode, publicGuest } from "@/lib/api-guest";

export const OPTIONS = preflight;

/** Data satu tamu untuk halaman undangannya ("Kepada Yth. …"). Aman untuk kunci undangan. */
export const GET = handler<{ code: string }>("any", async ({ weddingId }, { code }) => {
  const [row] = await db.select().from(schema.guest).where(byCode(weddingId, code));
  if (!row) throw notFound("Undangan");
  return publicGuest(row);
});
