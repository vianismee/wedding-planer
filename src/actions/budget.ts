"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { parseRupiah, rupiah, todayISO } from "@/lib/format";
import { balanceOf } from "@/lib/savings";

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

/* ---------- Tabungan ---------- */

const goalSchema = z.object({
  name: z.string().min(1, "Isi nama tabungan.").max(60),
  side: z.enum(["pengantin", "pria", "wanita", "lainnya"]),
  target: amount.min(1, "Isi target tabungan."),
  frequency: z.enum(["harian", "mingguan", "bulanan"], { message: "Pilih rencana setoran." }),
  startDate: isoDate,
  dueDate: isoDate.nullable(),
});

function parseGoal(fd: FormData) {
  const g = goalSchema.parse({
    name: str(fd, "name"),
    side: str(fd, "side") || "pengantin",
    target: parseRupiah(str(fd, "target")),
    frequency: str(fd, "frequency") || "bulanan",
    startDate: str(fd, "startDate") || todayISO(),
    dueDate: optStr(fd, "dueDate"),
  });
  if (g.dueDate && g.dueDate <= g.startDate) throw new UserError("Tanggal target harus setelah tanggal mulai menabung.");
  return g;
}

async function ownGoal(weddingId: string, id: string) {
  const [g] = await db.select().from(schema.savingsGoal).where(and(eq(schema.savingsGoal.id, id), eq(schema.savingsGoal.weddingId, weddingId)));
  if (!g) throw new UserError("Tabungan tidak ditemukan.");
  return g;
}

export async function addGoal(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db.insert(schema.savingsGoal).values({ ...parseGoal(fd), weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateGoal(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db
      .update(schema.savingsGoal)
      .set(parseGoal(fd))
      .where(and(eq(schema.savingsGoal.id, id), eq(schema.savingsGoal.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db.delete(schema.savingsGoal).where(and(eq(schema.savingsGoal.id, id), eq(schema.savingsGoal.weddingId, ctx.wedding.id)));
    done();
  });
}

const depositSchema = z.object({
  kind: z.enum(["masuk", "keluar"]),
  amount: amount.min(1, "Isi nominal."),
  date: isoDate,
  note: z.string().max(160).nullable(),
});

const parseDeposit = (fd: FormData) =>
  depositSchema.parse({
    kind: str(fd, "kind") || "masuk",
    amount: parseRupiah(str(fd, "amount")),
    date: str(fd, "date") || todayISO(),
    note: optStr(fd, "note"),
  });

/**
 * Saldo tabungan tidak boleh minus setelah perubahan. `skipId` = transaksi yang diubah atau dihapus,
 * `next` = isi barunya (kosong saat menghapus).
 */
async function assertBalance(goalId: string, next: { kind: string; amount: number } | null, skipId?: string) {
  const rows = (await db.select().from(schema.savingsDeposit).where(eq(schema.savingsDeposit.goalId, goalId))).filter((r) => r.id !== skipId);
  const balance = balanceOf(rows);
  if (balanceOf(next ? [...rows, next] : rows) >= 0) return;
  throw new UserError(
    next?.kind === "keluar"
      ? `Saldo tabungan hanya ${rupiah(balance)}. Penarikan tidak bisa lebih dari saldo.`
      : "Saldo tabungan akan minus karena sudah ada penarikan. Hapus atau kurangi penarikannya dulu.",
  );
}

export async function addDeposit(goalId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const g = await ownGoal(ctx.wedding.id, goalId);
    const data = parseDeposit(fd);
    await assertBalance(g.id, data);
    await db.insert(schema.savingsDeposit).values({ ...data, goalId: g.id, weddingId: ctx.wedding.id });
    done();
    return data.kind === "keluar" ? `Penarikan dari ${g.name} tercatat.` : `Setoran ${g.name} tercatat.`;
  });
}

export async function updateDeposit(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const d = await ownDeposit(ctx.wedding.id, id);
    const data = parseDeposit(fd);
    await assertBalance(d.goalId, data, d.id);
    await db.update(schema.savingsDeposit).set(data).where(eq(schema.savingsDeposit.id, d.id));
    done();
  });
}

async function ownDeposit(weddingId: string, id: string) {
  const [d] = await db.select().from(schema.savingsDeposit).where(and(eq(schema.savingsDeposit.id, id), eq(schema.savingsDeposit.weddingId, weddingId)));
  if (!d) throw new UserError("Transaksi tidak ditemukan.");
  return d;
}

export async function deleteDeposit(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const d = await ownDeposit(ctx.wedding.id, id);
    await assertBalance(d.goalId, null, d.id);
    await db.delete(schema.savingsDeposit).where(eq(schema.savingsDeposit.id, d.id));
    done();
  });
}

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
