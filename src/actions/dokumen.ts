"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { deleteObject } from "@/lib/storage";

function done() {
  revalidatePath("/dokumen");
  revalidatePath("/dashboard");
}

async function ownDoc(weddingId: string, id: string) {
  const [d] = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.id, id), eq(schema.document.weddingId, weddingId)));
  if (!d) throw new UserError("Dokumen tidak ditemukan.");
  return d;
}

/** Menghapus file scan secara permanen dari penyimpanan dan database. */
async function purgeFile(weddingId: string, fileId: string) {
  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, fileId), eq(schema.file.weddingId, weddingId)));
  if (!f) return;
  await deleteObject(f.key);
  await db.delete(schema.file).where(eq(schema.file.id, f.id));
}

export async function addDocument(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("dokumen");
    const data = z
      .object({ name: z.string().min(1, "Isi nama dokumen.").max(120), person: z.enum(["pria", "wanita"]) })
      .parse({ name: str(fd, "name"), person: str(fd, "person") });
    await db.insert(schema.document).values({ ...data, weddingId: ctx.wedding.id, sortOrder: 999 });
    done();
  });
}

export async function updateDocument(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("dokumen");
    const d = await ownDoc(ctx.wedding.id, id);
    const data = z
      .object({
        name: z.string().min(1, "Isi nama dokumen.").max(120),
        status: z.enum(["belum", "diproses", "lengkap"]),
        note: z.string().max(200).nullable(),
        fileId: z.string().nullable(),
      })
      .parse({ name: str(fd, "name"), status: str(fd, "status"), note: optStr(fd, "note"), fileId: optStr(fd, "fileId") });
    if (data.fileId && data.fileId !== d.fileId) {
      const [f] = await db
        .select()
        .from(schema.file)
        .where(and(eq(schema.file.id, data.fileId), eq(schema.file.weddingId, ctx.wedding.id), eq(schema.file.kind, "document")));
      if (!f) throw new UserError("File scan tidak ditemukan.");
    }
    // Scan yang dilepas atau diganti dihapus permanen.
    if (d.fileId && d.fileId !== data.fileId) await purgeFile(ctx.wedding.id, d.fileId);
    const nextStatus = data.fileId && data.status === "belum" ? "lengkap" : data.status;
    await db.update(schema.document).set({ ...data, status: nextStatus }).where(eq(schema.document.id, id));
    done();
  });
}

export async function setDocumentStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("dokumen");
    await ownDoc(ctx.wedding.id, id);
    await db
      .update(schema.document)
      .set({ status: z.enum(["belum", "diproses", "lengkap"]).parse(status) })
      .where(eq(schema.document.id, id));
    done();
  });
}

export async function deleteDocumentFile(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("dokumen");
    const d = await ownDoc(ctx.wedding.id, id);
    if (d.fileId) {
      await db.update(schema.document).set({ fileId: null }).where(eq(schema.document.id, id));
      await purgeFile(ctx.wedding.id, d.fileId);
    }
    done();
    return "Scan dihapus permanen.";
  });
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("dokumen");
    const d = await ownDoc(ctx.wedding.id, id);
    await db.delete(schema.document).where(eq(schema.document.id, id));
    if (d.fileId) await purgeFile(ctx.wedding.id, d.fileId);
    done();
  });
}
