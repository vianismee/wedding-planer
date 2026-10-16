"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";

const scheduleSchema = z.object({
  title: z.string().min(1, "Isi nama jadwal.").max(120),
  kind: z.enum(["test_food", "fitting", "survey", "meeting", "lainnya"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal jadwal."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  location: z.string().max(160).nullable(),
  vendorId: z.string().nullable(),
  note: z.string().max(300).nullable(),
});

async function parse(fd: FormData, weddingId: string) {
  const data = scheduleSchema.parse({
    title: str(fd, "title"),
    kind: str(fd, "kind") || "lainnya",
    date: str(fd, "date"),
    startTime: optStr(fd, "startTime"),
    location: optStr(fd, "location"),
    vendorId: optStr(fd, "vendorId"),
    note: optStr(fd, "note"),
  });
  if (data.vendorId) {
    const [v] = await db
      .select()
      .from(schema.vendor)
      .where(and(eq(schema.vendor.id, data.vendorId), eq(schema.vendor.weddingId, weddingId)));
    if (!v) throw new UserError("Vendor tidak ditemukan.");
  }
  return data;
}

function done() {
  revalidatePath("/dashboard");
  revalidatePath("/jadwal");
}

// Jadwal bisa dikelola Pemilik, Pasangan, dan Keluarga.
export async function addSchedule(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("jadwal");
    const data = await parse(fd, ctx.wedding.id);
    await db.insert(schema.schedule).values({ ...data, weddingId: ctx.wedding.id, createdBy: ctx.user.id });
    done();
    return `${data.title} ditambahkan ke jadwal.`;
  });
}

export async function updateSchedule(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("jadwal");
    const data = await parse(fd, ctx.wedding.id);
    const [row] = await db
      .update(schema.schedule)
      .set(data)
      .where(and(eq(schema.schedule.id, id), eq(schema.schedule.weddingId, ctx.wedding.id)))
      .returning();
    if (!row) throw new UserError("Jadwal tidak ditemukan.");
    done();
  });
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("jadwal");
    await db.delete(schema.schedule).where(and(eq(schema.schedule.id, id), eq(schema.schedule.weddingId, ctx.wedding.id)));
    done();
  });
}
