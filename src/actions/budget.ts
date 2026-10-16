"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { parseRupiah, todayISO } from "@/lib/format";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal.");
const amount = z.number().int().min(0).max(100_000_000_000);

function done() {
  revalidatePath("/budget");
  revalidatePath("/vendor");
  revalidatePath("/dashboard");
}

/* ---------- Kategori ---------- */

const categorySchema = z.object({
  name: z.string().min(1, "Isi nama kategori.").max(60),
  allocation: amount,
  need: z.string().max(160).nullable(),
});

const parseCategory = (fd: FormData) =>
  categorySchema.parse({ name: str(fd, "name"), allocation: parseRupiah(str(fd, "allocation")), need: optStr(fd, "need") });

export async function addCategory(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const id = crypto.randomUUID();
    await db.insert(schema.budgetCategory).values({ id, ...parseCategory(fd), weddingId: ctx.wedding.id, sortOrder: 99 });
    done();
    return { id };
  });
}

export async function updateCategory(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .update(schema.budgetCategory)
      .set(parseCategory(fd))
      .where(and(eq(schema.budgetCategory.id, id), eq(schema.budgetCategory.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .delete(schema.budgetCategory)
      .where(and(eq(schema.budgetCategory.id, id), eq(schema.budgetCategory.weddingId, ctx.wedding.id)));
    done();
  });
}

/* ---------- Sumber dana ---------- */

const fundingSchema = z.object({
  name: z.string().min(1, "Isi nama sumber dana.").max(60),
  side: z.enum(["pengantin", "pria", "wanita", "lainnya"]),
  amount,
});
const parseFunding = (fd: FormData) =>
  fundingSchema.parse({ name: str(fd, "name"), side: str(fd, "side") || "pengantin", amount: parseRupiah(str(fd, "amount")) });

export async function addFunding(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db.insert(schema.fundingSource).values({ ...parseFunding(fd), weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateFunding(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .update(schema.fundingSource)
      .set(parseFunding(fd))
      .where(and(eq(schema.fundingSource.id, id), eq(schema.fundingSource.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteFunding(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .delete(schema.fundingSource)
      .where(and(eq(schema.fundingSource.id, id), eq(schema.fundingSource.weddingId, ctx.wedding.id)));
    done();
  });
}

/* ---------- Pengeluaran ---------- */

async function checkRefs(weddingId: string, refs: { categoryId?: string | null; fundingSourceId?: string | null; fileId?: string | null }) {
  if (refs.categoryId) {
    const [c] = await db
      .select()
      .from(schema.budgetCategory)
      .where(and(eq(schema.budgetCategory.id, refs.categoryId), eq(schema.budgetCategory.weddingId, weddingId)));
    if (!c) throw new UserError("Kategori tidak ditemukan.");
  }
  if (refs.fundingSourceId) {
    const [f] = await db
      .select()
      .from(schema.fundingSource)
      .where(and(eq(schema.fundingSource.id, refs.fundingSourceId), eq(schema.fundingSource.weddingId, weddingId)));
    if (!f) throw new UserError("Sumber dana tidak ditemukan.");
  }
  if (refs.fileId) {
    const [f] = await db
      .select()
      .from(schema.file)
      .where(and(eq(schema.file.id, refs.fileId), eq(schema.file.weddingId, weddingId)));
    if (!f) throw new UserError("Lampiran tidak ditemukan.");
  }
}

const expenseSchema = z.object({
  description: z.string().min(1, "Isi keterangan pengeluaran.").max(160),
  amount: amount.min(1, "Isi nominal pengeluaran."),
  date: isoDate,
  categoryId: z.string().nullable(),
  fundingSourceId: z.string().nullable(),
  receiptFileId: z.string().nullable(),
});

const parseExpense = (fd: FormData) =>
  expenseSchema.parse({
    description: str(fd, "description"),
    amount: parseRupiah(str(fd, "amount")),
    date: str(fd, "date") || todayISO(),
    categoryId: optStr(fd, "categoryId"),
    fundingSourceId: optStr(fd, "fundingSourceId"),
    receiptFileId: optStr(fd, "receiptFileId"),
  });

export async function addExpense(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const data = parseExpense(fd);
    await checkRefs(ctx.wedding.id, { ...data, fileId: data.receiptFileId });
    await db.insert(schema.expense).values({ ...data, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateExpense(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const data = parseExpense(fd);
    await checkRefs(ctx.wedding.id, { ...data, fileId: data.receiptFileId });
    await db
      .update(schema.expense)
      .set(data)
      .where(and(eq(schema.expense.id, id), eq(schema.expense.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const [e] = await db
      .delete(schema.expense)
      .where(and(eq(schema.expense.id, id), eq(schema.expense.weddingId, ctx.wedding.id)))
      .returning();
    // Pengeluaran dari termin: termin kembali menjadi belum dibayar.
    if (e?.paymentTermId) await db.update(schema.paymentTerm).set({ paidAt: null }).where(eq(schema.paymentTerm.id, e.paymentTermId));
    done();
  });
}

/* ---------- Termin vendor ---------- */

const termSchema = z.object({
  label: z.string().min(1, "Isi nama termin, misalnya DP atau Pelunasan.").max(40),
  amount: amount.min(1, "Isi nominal termin."),
  dueDate: isoDate,
});
const parseTerm = (fd: FormData) =>
  termSchema.parse({ label: str(fd, "label"), amount: parseRupiah(str(fd, "amount")), dueDate: str(fd, "dueDate") });

export async function addTerm(vendorId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const [v] = await db
      .select()
      .from(schema.vendor)
      .where(and(eq(schema.vendor.id, vendorId), eq(schema.vendor.weddingId, ctx.wedding.id)));
    if (!v) throw new UserError("Vendor tidak ditemukan.");
    await db.insert(schema.paymentTerm).values({ ...parseTerm(fd), vendorId, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateTerm(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const data = parseTerm(fd);
    await db
      .update(schema.paymentTerm)
      .set({ ...data, remindedH7: false, remindedH1: false })
      .where(and(eq(schema.paymentTerm.id, id), eq(schema.paymentTerm.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteTerm(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .delete(schema.paymentTerm)
      .where(and(eq(schema.paymentTerm.id, id), eq(schema.paymentTerm.weddingId, ctx.wedding.id)));
    done();
  });
}

/** Menandai termin lunas dan mencatatnya sebagai pengeluaran (dengan bukti bayar opsional). */
export async function payTerm(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const [t] = await db
      .select({ term: schema.paymentTerm, vendor: schema.vendor })
      .from(schema.paymentTerm)
      .innerJoin(schema.vendor, eq(schema.paymentTerm.vendorId, schema.vendor.id))
      .where(and(eq(schema.paymentTerm.id, id), eq(schema.paymentTerm.weddingId, ctx.wedding.id)));
    if (!t) throw new UserError("Termin tidak ditemukan.");
    if (t.term.paidAt) throw new UserError("Termin ini sudah lunas.");
    const date = str(fd, "date") || todayISO();
    const fundingSourceId = optStr(fd, "fundingSourceId");
    const receiptFileId = optStr(fd, "receiptFileId");
    await checkRefs(ctx.wedding.id, { fundingSourceId, fileId: receiptFileId });
    await db.transaction(async (tx) => {
      await tx.update(schema.paymentTerm).set({ paidAt: date }).where(eq(schema.paymentTerm.id, id));
      await tx.insert(schema.expense).values({
        weddingId: ctx.wedding.id,
        categoryId: t.vendor.categoryId,
        description: `${t.term.label} ${t.vendor.name}`,
        amount: t.term.amount,
        date,
        fundingSourceId,
        receiptFileId,
        paymentTermId: id,
      });
    });
    done();
    return `${t.term.label} ${t.vendor.name} ditandai lunas.`;
  });
}
