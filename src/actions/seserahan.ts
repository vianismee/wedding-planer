"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { parseRupiah } from "@/lib/format";

function done() {
  revalidatePath("/seserahan");
  revalidatePath("/dashboard");
}

// Link pembelian hanya http/https supaya tidak bisa dipakai untuk javascript: atau skema lain.
const purchaseUrl = z
  .string()
  .max(1000)
  .nullable()
  .transform((v) => {
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Link pembelian tidak valid. Contoh: https://tokopedia.com/...");

const status = z.enum(["belum", "dipesan", "terbeli"]);

const itemSchema = z.object({
  category: z.string().min(1, "Isi kategori.").max(60),
  name: z.string().min(1, "Isi nama item.").max(120),
  status,
  price: z.number().int().min(0).max(10_000_000_000),
  pic: z.string().max(80).nullable(),
  note: z.string().max(200).nullable(),
  purchaseUrl,
});

const parseItem = (fd: FormData) =>
  itemSchema.parse({
    category: str(fd, "category"),
    name: str(fd, "name"),
    status: str(fd, "status") || "belum",
    price: parseRupiah(str(fd, "price")),
    pic: optStr(fd, "pic"),
    note: optStr(fd, "note"),
    purchaseUrl: optStr(fd, "purchaseUrl"),
  });

export async function addItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db.insert(schema.seserahanItem).values({ ...parseItem(fd), weddingId: ctx.wedding.id, sortOrder: 999 });
    done();
  });
}

export async function updateItem(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db
      .update(schema.seserahanItem)
      .set(parseItem(fd))
      .where(and(eq(schema.seserahanItem.id, id), eq(schema.seserahanItem.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function setItemStatus(id: string, value: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db
      .update(schema.seserahanItem)
      .set({ status: status.parse(value) })
      .where(and(eq(schema.seserahanItem.id, id), eq(schema.seserahanItem.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteItem(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db
      .delete(schema.seserahanItem)
      .where(and(eq(schema.seserahanItem.id, id), eq(schema.seserahanItem.weddingId, ctx.wedding.id)));
    done();
  });
}

const maharSchema = z.object({
  name: z.string().min(1, "Isi nama item mahar.").max(160),
  value: z.number().int().min(0).max(100_000_000_000),
  status: z.enum(["belum", "terbeli"]),
  keeper: z.string().max(80).nullable(),
  purchaseUrl,
  note: z.string().max(400).nullable(),
});

const parseMahar = (fd: FormData) =>
  maharSchema.parse({
    name: str(fd, "name"),
    value: parseRupiah(str(fd, "value")),
    status: str(fd, "status") || "belum",
    keeper: optStr(fd, "keeper"),
    purchaseUrl: optStr(fd, "purchaseUrl"),
    note: optStr(fd, "note"),
  });

export async function addMahar(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db.insert(schema.maharItem).values({ ...parseMahar(fd), weddingId: ctx.wedding.id, sortOrder: 999 });
    done();
  });
}

export async function updateMahar(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    const [row] = await db
      .update(schema.maharItem)
      .set(parseMahar(fd))
      .where(and(eq(schema.maharItem.id, id), eq(schema.maharItem.weddingId, ctx.wedding.id)))
      .returning();
    if (!row) throw new UserError("Item mahar tidak ditemukan.");
    done();
  });
}

export async function deleteMahar(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("seserahan");
    await db.delete(schema.maharItem).where(and(eq(schema.maharItem.id, id), eq(schema.maharItem.weddingId, ctx.wedding.id)));
    done();
  });
}
