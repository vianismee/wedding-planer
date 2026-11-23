import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, notFound, preflight } from "@/lib/api";

export const OPTIONS = preflight;

/** Info pernikahan dan rangkaian acara untuk ditampilkan di undangan. */
export const GET = handler("any", async ({ weddingId }) => {
  const [w] = await db.select().from(schema.wedding).where(eq(schema.wedding.id, weddingId));
  if (!w) throw notFound("Pernikahan");
  const events = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.weddingId, weddingId))
    .orderBy(asc(schema.event.sortOrder), asc(schema.event.date));
  return {
    groomName: w.groomName,
    brideName: w.brideName,
    akadDate: w.akadDate,
    city: w.city,
    accent: w.accent,
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      date: e.date,
      startTime: e.startTime,
      location: e.location,
    })),
  };
});
