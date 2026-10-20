"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { diffDays } from "@/lib/format";

function done() {
  revalidatePath("/checklist");
  revalidatePath("/dashboard");
  revalidatePath("/acara");
}

const taskSchema = z.object({
  title: z.string().min(1, "Isi nama tugas.").max(160),
  pic: z.string().max(80).nullable(),
  assigneeMemberId: z.string().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tenggat."),
});

async function parseTask(fd: FormData, weddingId: string, akadDate: string) {
  const data = taskSchema.parse({
    title: str(fd, "title"),
    pic: optStr(fd, "pic"),
    assigneeMemberId: optStr(fd, "assigneeMemberId"),
    dueDate: str(fd, "dueDate"),
  });
  if (data.assigneeMemberId) {
    const [m] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.id, data.assigneeMemberId), eq(schema.member.weddingId, weddingId)));
    if (!m) throw new UserError("Anggota tidak ditemukan.");
  }
  // Tenggat disimpan sebagai jarak hari dari akad.
  return {
    title: data.title,
    pic: data.pic,
    assigneeMemberId: data.assigneeMemberId,
    offsetDays: diffDays(akadDate, data.dueDate),
  };
}

export async function addTask(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("checklist");
    const data = await parseTask(fd, ctx.wedding.id, ctx.wedding.akadDate);
    await db.insert(schema.task).values({ ...data, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateTask(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("checklist");
    const data = await parseTask(fd, ctx.wedding.id, ctx.wedding.akadDate);
    await db
      .update(schema.task)
      .set(data)
      .where(and(eq(schema.task.id, id), eq(schema.task.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("checklist");
    await db.delete(schema.task).where(and(eq(schema.task.id, id), eq(schema.task.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function toggleTask(id: string, value: boolean): Promise<ActionResult> {
  return run(async () => {
    // Yang hanya boleh melihat atau "Tugas sendiri" tetap bisa mencentang tugas yang ditugaskan kepadanya.
    const ctx = await requireAction("checklist", "view");
    const [t] = await db
      .select()
      .from(schema.task)
      .where(and(eq(schema.task.id, id), eq(schema.task.weddingId, ctx.wedding.id)));
    if (!t) throw new UserError("Tugas tidak ditemukan.");
    if (ctx.perms.checklist !== "edit" && t.assigneeMemberId !== ctx.member.id)
      throw new UserError("Kamu hanya bisa mencentang tugasmu sendiri.");
    await db
      .update(schema.task)
      .set({ done: value, doneAt: value ? new Date() : null })
      .where(eq(schema.task.id, id));
    done();
  });
}
