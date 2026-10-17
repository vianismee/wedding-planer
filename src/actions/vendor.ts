"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { addDays, parseRupiah, todayISO } from "@/lib/format";
import { track } from "@/lib/analytics";
import { addonsTotal, dpLabel, dpValue, offerTotal } from "@/lib/offer";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal.");

function done() {
  revalidatePath("/vendor");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

async function ownCategory(weddingId: string, id: string) {
  const [c] = await db
    .select()
    .from(schema.budgetCategory)
    .where(and(eq(schema.budgetCategory.id, id), eq(schema.budgetCategory.weddingId, weddingId)));
  if (!c) throw new UserError("Pilih kategori budget.");
  return c;
}

async function ownFile(weddingId: string, id: string | null) {
  if (!id) return;
  const [f] = await db.select().from(schema.file).where(and(eq(schema.file.id, id), eq(schema.file.weddingId, weddingId)));
  if (!f) throw new UserError("Lampiran tidak ditemukan.");
}

/* ---------- Penawaran ---------- */

const offerSchema = z.object({
  categoryId: z.string().min(1, "Pilih kategori."),
  vendorName: z.string().min(1, "Isi nama vendor.").max(80),
  packageName: z.string().max(80).nullable(),
  price: z.number().int().min(1, "Isi harga paket.").max(100_000_000_000),
  includeItems: z.array(z.string().min(1).max(200)).max(60, "Maksimal 60 item isi paket."),
  addons: z
    .array(
      z.object({
        label: z.string().min(1, "Isi nama add-on.").max(120),
        qty: z.number().int().min(1, "Jumlah add-on minimal 1.").max(100_000),
        price: z.number().int().min(0).max(10_000_000_000),
      }),
    )
    .max(30, "Maksimal 30 add-on."),
  dpType: z.enum(["percent", "nominal", "none"]),
  dpPercent: z.number().int().min(0, "Persen DP 0 sampai 100.").max(100, "Persen DP 0 sampai 100."),
  dpAmount: z.number().int().min(0).max(100_000_000_000),
  availability: z.string().max(120).nullable(),
  available: z.boolean(),
  notes: z.string().max(400).nullable(),
  contact: z.string().max(80).nullable(),
  attachmentFileId: z.string().nullable(),
});

function readAddons(fd: FormData) {
  const labels = fd.getAll("addonLabel").map((v) => String(v).trim());
  const qtys = fd.getAll("addonQty").map((v) => Number(v || 1));
  const prices = fd.getAll("addonPrice").map((v) => parseRupiah(String(v)));
  // Baris yang benar-benar kosong diabaikan.
  return labels
    .map((label, i) => ({ label, qty: qtys[i] ?? 1, price: prices[i] ?? 0 }))
    .filter((a) => a.label || a.price);
}

const parseOffer = (fd: FormData) =>
  offerSchema.parse({
    categoryId: str(fd, "categoryId"),
    vendorName: str(fd, "vendorName"),
    packageName: optStr(fd, "packageName"),
    price: parseRupiah(str(fd, "price")),
    includeItems: fd
      .getAll("includeItem")
      .map((v) => String(v).trim())
      .filter(Boolean),
    addons: readAddons(fd),
    dpType: str(fd, "dpType") || "percent",
    dpPercent: Number(str(fd, "dpPercent") || 0),
    dpAmount: parseRupiah(str(fd, "dpAmount")),
    availability: optStr(fd, "availability"),
    available: str(fd, "available") !== "belum",
    notes: optStr(fd, "notes"),
    contact: optStr(fd, "contact"),
    attachmentFileId: optStr(fd, "attachmentFileId"),
  });

export async function addOffer(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const data = parseOffer(fd);
    await ownCategory(ctx.wedding.id, data.categoryId);
    await ownFile(ctx.wedding.id, data.attachmentFileId);
    await db.insert(schema.offer).values({ ...data, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateOffer(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const data = parseOffer(fd);
    await ownCategory(ctx.wedding.id, data.categoryId);
    await ownFile(ctx.wedding.id, data.attachmentFileId);
    await db
      .update(schema.offer)
      .set(data)
      .where(and(eq(schema.offer.id, id), eq(schema.offer.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteOffer(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    await db.delete(schema.offer).where(and(eq(schema.offer.id, id), eq(schema.offer.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function trackCompare(categoryId: string) {
  const ctx = await requireAction("vendor");
  track("offer_compared", { weddingId: ctx.wedding.id, role: ctx.member.role });
  void categoryId;
}

/**
 * Memilih penawaran: penawaran menjadi vendor terpesan, lalu termin DP
 * (dan pelunasan sisa bila ada) dibuat di Budget.
 */
export async function chooseOffer(offerId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const [o] = await db
      .select()
      .from(schema.offer)
      .where(and(eq(schema.offer.id, offerId), eq(schema.offer.weddingId, ctx.wedding.id)));
    if (!o) throw new UserError("Penawaran tidak ditemukan.");
    if (o.status === "dipilih") throw new UserError("Penawaran ini sudah dipilih.");
    const dpDue = isoDate.parse(str(fd, "dpDue") || addDays(todayISO(), 7));
    const settleDue = isoDate.parse(str(fd, "settleDue") || addDays(ctx.wedding.akadDate, -14));
    // DP dan pelunasan dihitung dari total paket + add-on.
    const total = offerTotal(o);
    const dp = dpValue(o);
    const rest = total - dp;

    let vendorName = o.vendorName;
    await db.transaction(async (tx) => {
      // Satu kategori satu penawaran terpilih: kembalikan pilihan lain ke status dibandingkan.
      await tx
        .update(schema.offer)
        .set({ status: "dibandingkan" })
        .where(and(eq(schema.offer.categoryId, o.categoryId), ne(schema.offer.id, o.id)));
      await tx.update(schema.offer).set({ status: "dipilih" }).where(eq(schema.offer.id, o.id));
      const vendorId = crypto.randomUUID();
      await tx.insert(schema.vendor).values({
        id: vendorId,
        weddingId: ctx.wedding.id,
        categoryId: o.categoryId,
        offerId: o.id,
        name: o.vendorName,
        packageName: o.packageName,
        packagePrice: o.price,
        includeItems: o.includeItems,
        addons: o.addons,
        packageDesc: o.notes,
        contact: o.contact,
        totalPrice: total,
      });
      const terms = [];
      if (dp > 0) terms.push({ label: dpLabel(o), amount: dp, dueDate: dpDue });
      if (rest > 0) terms.push({ label: "Pelunasan", amount: rest, dueDate: settleDue });
      if (terms.length)
        await tx.insert(schema.paymentTerm).values(terms.map((t) => ({ ...t, vendorId, weddingId: ctx.wedding.id })));
      vendorName = o.vendorName;
    });
    track("offer_chosen", { weddingId: ctx.wedding.id, role: ctx.member.role });
    done();
    return `${vendorName} tersimpan sebagai vendor. Termin DP sudah dijadwalkan di Budget.`;
  });
}

/**
 * Membatalkan pilihan: penawaran tetap ada di perbandingan, tetapi vendor terpesan dan
 * termin DP/pelunasannya dihapus. Pengeluaran yang sudah dibayar tetap tercatat di Budget.
 */
export async function cancelOffer(offerId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const [o] = await db
      .update(schema.offer)
      .set({ status: "dibandingkan" })
      .where(and(eq(schema.offer.id, offerId), eq(schema.offer.weddingId, ctx.wedding.id)))
      .returning();
    if (!o) throw new UserError("Penawaran tidak ditemukan.");
    // Termin ikut terhapus lewat cascade.
    await db.delete(schema.vendor).where(and(eq(schema.vendor.offerId, o.id), eq(schema.vendor.weddingId, ctx.wedding.id)));
    done();
    return `Pesanan ${o.vendorName} dibatalkan. Penawarannya kembali ke daftar perbandingan.`;
  });
}

/* ---------- Vendor terpesan ---------- */

const vendorSchema = z.object({
  name: z.string().min(1, "Isi nama vendor.").max(80),
  categoryId: z.string().nullable(),
  packageName: z.string().max(80).nullable(),
  packagePrice: z.number().int().min(0).max(100_000_000_000),
  includeItems: z.array(z.string().min(1).max(200)).max(60, "Maksimal 60 item isi paket."),
  addons: z
    .array(
      z.object({
        label: z.string().min(1, "Isi nama add-on.").max(120),
        qty: z.number().int().min(1, "Jumlah add-on minimal 1.").max(100_000),
        price: z.number().int().min(0).max(10_000_000_000),
      }),
    )
    .max(30, "Maksimal 30 add-on."),
  packageDesc: z.string().max(2000).nullable(),
  contact: z.string().max(80).nullable(),
});

function parseVendor(fd: FormData) {
  const data = vendorSchema.parse({
    name: str(fd, "name"),
    categoryId: optStr(fd, "categoryId"),
    packageName: optStr(fd, "packageName"),
    packagePrice: parseRupiah(str(fd, "price")),
    includeItems: fd
      .getAll("includeItem")
      .map((v) => String(v).trim())
      .filter(Boolean),
    addons: readAddons(fd),
    packageDesc: optStr(fd, "packageDesc"),
    contact: optStr(fd, "contact"),
  });
  // Total selalu dihitung ulang dari harga paket + add-on.
  return { ...data, totalPrice: data.packagePrice + addonsTotal(data.addons) };
}

export async function addVendor(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const data = parseVendor(fd);
    if (data.categoryId) await ownCategory(ctx.wedding.id, data.categoryId);
    await db.insert(schema.vendor).values({ ...data, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updateVendor(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const data = parseVendor(fd);
    if (data.categoryId) await ownCategory(ctx.wedding.id, data.categoryId);
    await db
      .update(schema.vendor)
      .set(data)
      .where(and(eq(schema.vendor.id, id), eq(schema.vendor.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const [v] = await db
      .delete(schema.vendor)
      .where(and(eq(schema.vendor.id, id), eq(schema.vendor.weddingId, ctx.wedding.id)))
      .returning();
    if (v?.offerId) await db.update(schema.offer).set({ status: "dibandingkan" }).where(eq(schema.offer.id, v.offerId));
    done();
  });
}

/** Membuat atau mencabut link ringkasan pesanan yang bisa dibuka vendor tanpa login. */
export async function setVendorShare(id: string, enabled: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const token = enabled ? crypto.randomUUID().replace(/-/g, "").slice(0, 24) : null;
    const [v] = await db
      .update(schema.vendor)
      .set({ shareToken: token })
      .where(and(eq(schema.vendor.id, id), eq(schema.vendor.weddingId, ctx.wedding.id)))
      .returning();
    if (!v) throw new UserError("Vendor tidak ditemukan.");
    done();
    return enabled ? "Link untuk vendor dibuat." : "Link untuk vendor dicabut. Link lama tidak bisa dibuka lagi.";
  });
}
