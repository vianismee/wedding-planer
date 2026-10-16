"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { addDays } from "@/lib/format";
import { rundownTemplates, templateEvents } from "@/lib/templates";

const eventSchema = z.object({
  name: z.string().min(1, "Isi nama acara.").max(80),
  kind: z.string().max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  location: z.string().max(160).nullable(),
  estimatedGuests: z.number().int().min(0).max(100_000).nullable(),
  status: z.enum(["persiapan", "lokasi_belum", "selesai"]),
});

function parseEvent(fd: FormData) {
  const guests = str(fd, "estimatedGuests");
  return eventSchema.parse({
    name: str(fd, "name"),
    kind: str(fd, "kind") || "lainnya",
    date: optStr(fd, "date"),
    startTime: optStr(fd, "startTime"),
    location: optStr(fd, "location"),
    estimatedGuests: guests ? Number(guests) : null,
    status: str(fd, "status") || "persiapan",
  });
}

function done() {
  revalidatePath("/acara");
  revalidatePath("/dashboard");
}

async function ownEvent(weddingId: string, id: string) {
  const [e] = await db
    .select()
    .from(schema.event)
    .where(and(eq(schema.event.id, id), eq(schema.event.weddingId, weddingId)));
  if (!e) throw new UserError("Acara tidak ditemukan.");
  return e;
}

export async function addEvent(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    const data = parseEvent(fd);
    const existing = await db.select().from(schema.event).where(eq(schema.event.weddingId, ctx.wedding.id));
    const id = crypto.randomUUID();
    await db.insert(schema.event).values({ id, ...data, weddingId: ctx.wedding.id, sortOrder: existing.length });
    done();
    return { id };
  });
}

export async function updateEvent(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    await ownEvent(ctx.wedding.id, id);
    await db.update(schema.event).set(parseEvent(fd)).where(eq(schema.event.id, id));
    done();
  });
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    await ownEvent(ctx.wedding.id, id);
    await db.delete(schema.event).where(eq(schema.event.id, id));
    done();
  });
}

/** Menggeser urutan acara satu langkah ke atas atau bawah. */
export async function moveEvent(id: string, dir: -1 | 1): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    const list = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.weddingId, ctx.wedding.id))
      .orderBy(asc(schema.event.sortOrder), asc(schema.event.date));
    const i = list.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.transaction(async (tx) => {
      for (const [k, e] of list.entries()) await tx.update(schema.event).set({ sortOrder: k }).where(eq(schema.event.id, e.id));
    });
    done();
  });
}

/** Membuat atau mencabut link rundown baca-saja untuk panitia. */
export async function setEventShare(id: string, enabled: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    await ownEvent(ctx.wedding.id, id);
    const token = enabled ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : null;
    await db.update(schema.event).set({ shareToken: token }).where(eq(schema.event.id, id));
    done();
    return enabled ? "Link rundown dibuat." : "Link rundown dicabut.";
  });
}

/* ---------- Rundown ---------- */

const rundownSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Isi jam."),
  activity: z.string().min(1, "Isi kegiatan.").max(160),
  pic: z.string().max(80).nullable(),
});

async function sortRundown(eventId: string) {
  const rows = await db
    .select()
    .from(schema.rundownItem)
    .where(eq(schema.rundownItem.eventId, eventId))
    .orderBy(asc(schema.rundownItem.time), asc(schema.rundownItem.sortOrder));
  for (const [i, r] of rows.entries())
    if (r.sortOrder !== i) await db.update(schema.rundownItem).set({ sortOrder: i }).where(eq(schema.rundownItem.id, r.id));
}

export async function addRundown(eventId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    await ownEvent(ctx.wedding.id, eventId);
    const data = rundownSchema.parse({ time: str(fd, "time"), activity: str(fd, "activity"), pic: optStr(fd, "pic") });
    await db.insert(schema.rundownItem).values({ ...data, eventId, weddingId: ctx.wedding.id, sortOrder: 999 });
    await sortRundown(eventId);
    done();
  });
}

export async function updateRundown(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    const data = rundownSchema.parse({ time: str(fd, "time"), activity: str(fd, "activity"), pic: optStr(fd, "pic") });
    const [r] = await db
      .update(schema.rundownItem)
      .set(data)
      .where(and(eq(schema.rundownItem.id, id), eq(schema.rundownItem.weddingId, ctx.wedding.id)))
      .returning();
    if (!r) throw new UserError("Sesi rundown tidak ditemukan.");
    await sortRundown(r.eventId);
    done();
  });
}

export async function deleteRundown(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    await db
      .delete(schema.rundownItem)
      .where(and(eq(schema.rundownItem.id, id), eq(schema.rundownItem.weddingId, ctx.wedding.id)));
    done();
  });
}

/* ---------- Dari template ---------- */

/**
 * Menambahkan acara terpilih dari template adat, misalnya untuk mengembalikan acara yang terhapus.
 * Tanggal dihitung dari tanggal akad. Rundown bawaan ikut bila `withRundown`.
 */
export async function addEventsFromTemplate(tpl: string, names: string[], withRundown: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    const adat = z.enum(["jawa", "sunda", "nasional"], { message: "Pilih template adat." }).parse(tpl);
    const picked = templateEvents(adat).filter((e) => names.includes(e.name));
    if (picked.length === 0) throw new UserError("Pilih minimal satu acara dari template.");
    const existing = await db.select().from(schema.event).where(eq(schema.event.weddingId, ctx.wedding.id));
    await db.transaction(async (tx) => {
      for (const [i, e] of picked.entries()) {
        const eventId = crypto.randomUUID();
        await tx.insert(schema.event).values({
          id: eventId,
          weddingId: ctx.wedding.id,
          name: e.name,
          kind: e.kind,
          date: addDays(ctx.wedding.akadDate, e.offset),
          startTime: e.time,
          location: e.location,
          estimatedGuests: e.guests,
          sortOrder: existing.length + i,
        });
        if (withRundown && e.rundown?.length)
          await tx.insert(schema.rundownItem).values(
            e.rundown.map(([time, activity, pic], j) => ({ weddingId: ctx.wedding.id, eventId, time, activity, pic, sortOrder: j })),
          );
      }
    });
    done();
    return `${picked.length} acara ditambahkan dari template${withRundown ? " beserta rundown-nya" : ""}.`;
  });
}

/** Mengisi rundown satu acara dari template: ditambahkan ke yang ada, atau mengganti seluruhnya. */
export async function applyRundownTemplate(eventId: string, templateId: string, mode: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("acara.edit");
    const e = await ownEvent(ctx.wedding.id, eventId);
    const m = z.enum(["append", "replace"]).parse(mode);
    const tpl = rundownTemplates().find((t) => t.id === templateId);
    if (!tpl) throw new UserError("Template rundown tidak ditemukan.");
    await db.transaction(async (tx) => {
      if (m === "replace") await tx.delete(schema.rundownItem).where(eq(schema.rundownItem.eventId, e.id));
      await tx.insert(schema.rundownItem).values(
        tpl.items.map(([time, activity, pic], j) => ({ weddingId: ctx.wedding.id, eventId: e.id, time, activity, pic, sortOrder: 1000 + j })),
      );
    });
    await sortRundown(e.id);
    done();
    return m === "replace"
      ? `Rundown ${e.name} diganti dengan ${tpl.items.length} sesi dari template.`
      : `${tpl.items.length} sesi dari template ditambahkan ke rundown ${e.name}.`;
  });
}
