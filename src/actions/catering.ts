"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { parseRupiah } from "@/lib/format";
import { computeCatering } from "@/lib/catering";

const planSchema = z.object({
  name: z.string().min(1, "Isi nama skenario.").max(80),
  mode: z.enum(["per_pax", "masak_sendiri"]),
  paxSource: z.enum(["tamu", "manual"]),
  manualPax: z.number().int().min(0).max(100_000),
  bufferPercent: z.number().int().min(0).max(100),
  pricePerPax: z.number().int().min(0).max(100_000_000),
  ingredientPerPax: z.number().int().min(0).max(100_000_000),
  cooks: z.number().int().min(0).max(1000),
  cookWage: z.number().int().min(0).max(100_000_000),
  cookDays: z.number().int().min(0).max(60),
  equipmentCost: z.number().int().min(0).max(10_000_000_000),
  extras: z
    .array(z.object({ label: z.string().max(80), qty: z.number().int().min(0).max(100_000), price: z.number().int().min(0).max(10_000_000_000) }))
    .max(30),
  notes: z.string().max(400).nullable(),
});

const num = (fd: FormData, k: string) => Number(str(fd, k) || 0);

function parse(fd: FormData) {
  const labels = fd.getAll("extraLabel").map(String);
  const qtys = fd.getAll("extraQty").map((v) => Number(v || 0));
  const prices = fd.getAll("extraPrice").map((v) => parseRupiah(String(v)));
  return planSchema.parse({
    name: str(fd, "name"),
    mode: str(fd, "mode"),
    paxSource: str(fd, "paxSource") || "tamu",
    manualPax: num(fd, "manualPax"),
    bufferPercent: num(fd, "bufferPercent"),
    pricePerPax: parseRupiah(str(fd, "pricePerPax")),
    ingredientPerPax: parseRupiah(str(fd, "ingredientPerPax")),
    cooks: num(fd, "cooks"),
    cookWage: parseRupiah(str(fd, "cookWage")),
    cookDays: num(fd, "cookDays"),
    equipmentCost: parseRupiah(str(fd, "equipmentCost")),
    extras: labels
      .map((label, i) => ({ label: label.trim(), qty: qtys[i] ?? 0, price: prices[i] ?? 0 }))
      .filter((e) => e.label || e.price),
    notes: optStr(fd, "notes"),
  });
}

function done() {
  revalidatePath("/catering");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function addPlan(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db.insert(schema.cateringPlan).values({ ...parse(fd), weddingId: ctx.wedding.id });
    done();
  });
}

export async function updatePlan(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const [row] = await db
      .update(schema.cateringPlan)
      .set(parse(fd))
      .where(and(eq(schema.cateringPlan.id, id), eq(schema.cateringPlan.weddingId, ctx.wedding.id)))
      .returning();
    if (!row) throw new UserError("Skenario tidak ditemukan.");
    done();
  });
}

export async function deletePlan(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    await db.delete(schema.cateringPlan).where(and(eq(schema.cateringPlan.id, id), eq(schema.cateringPlan.weddingId, ctx.wedding.id)));
    done();
  });
}

/** Menjadikan total skenario sebagai alokasi kategori Catering di Budget (dibuat bila belum ada). */
export async function applyPlanToBudget(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("budget");
    const wid = ctx.wedding.id;
    const [plan] = await db
      .select()
      .from(schema.cateringPlan)
      .where(and(eq(schema.cateringPlan.id, id), eq(schema.cateringPlan.weddingId, wid)));
    if (!plan) throw new UserError("Skenario tidak ditemukan.");
    const guests = await db.select({ pax: schema.guest.pax }).from(schema.guest).where(eq(schema.guest.weddingId, wid));
    const { total } = computeCatering(plan, guests.reduce((s, g) => s + g.pax, 0));
    const [cat] = await db
      .select()
      .from(schema.budgetCategory)
      .where(and(eq(schema.budgetCategory.weddingId, wid), ilike(schema.budgetCategory.name, "catering%")));
    if (cat) await db.update(schema.budgetCategory).set({ allocation: total }).where(eq(schema.budgetCategory.id, cat.id));
    else await db.insert(schema.budgetCategory).values({ weddingId: wid, name: "Catering", allocation: total, sortOrder: 1 });
    done();
    return `Alokasi Catering di Budget diubah menjadi Rp ${total.toLocaleString("id-ID")}.`;
  });
}
