"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { addDays, parseRupiah, todayISO } from "@/lib/format";
import { track } from "@/lib/analytics";
import { addonsTotal, dpLabel, dpValue, effectiveDp, offerTotal } from "@/lib/offer";

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

/* ---------- Calon vendor dan paket ---------- */

const addonSchema = z
  .array(
    z.object({
      label: z.string().min(1, "Isi nama add-on.").max(120),
      qty: z.number().int().min(1, "Jumlah add-on minimal 1.").max(100_000),
      price: z.number().int().min(0).max(10_000_000_000),
    }),
  )
  .max(30, "Maksimal 30 add-on.");

const dpSchema = {
  dpType: z.enum(["percent", "nominal", "none"]),
  dpPercent: z.number().int().min(0, "Persen DP 0 sampai 100.").max(100, "Persen DP 0 sampai 100."),
  dpAmount: z.number().int().min(0).max(100_000_000_000),
};

// Info calon vendor: diisi sekali, berlaku untuk semua paketnya.
const prospectSchema = z.object({
  categoryId: z.string().min(1, "Pilih kategori."),
  name: z.string().min(1, "Isi nama vendor.").max(80),
  contact: z.string().max(80).nullable(),
  availability: z.string().max(120).nullable(),
  available: z.boolean(),
  notes: z.string().max(400).nullable(),
  ...dpSchema,
});

const packageSchema = z.object({
  packageName: z.string().max(80).nullable(),
  price: z.number().int().min(1, "Isi harga paket.").max(100_000_000_000),
  includeItems: z.array(z.string().min(1).max(200)).max(60, "Maksimal 60 item isi paket."),
  addons: addonSchema,
  notes: z.string().max(400).nullable(),
  attachmentFileId: z.string().nullable(),
  dpCustom: z.boolean(),
  ...dpSchema,
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

const readDp = (fd: FormData) => ({
  dpType: str(fd, "dpType") || "percent",
  dpPercent: Number(str(fd, "dpPercent") || 0),
  dpAmount: parseRupiah(str(fd, "dpAmount")),
});

const parseProspect = (fd: FormData) =>
  prospectSchema.parse({
    categoryId: str(fd, "categoryId"),
    name: str(fd, "vendorName"),
    contact: optStr(fd, "contact"),
    availability: optStr(fd, "availability"),
    available: str(fd, "available") !== "belum",
    notes: optStr(fd, "vendorNotes"),
    ...readDp(fd),
  });

/** Paket dari formulir. Formulir calon vendor baru tidak punya DP paket: paket pertama memakai DP vendor. */
function parsePackage(fd: FormData, withDp: boolean) {
  const custom = withDp && str(fd, "dpCustom") === "1";
  return packageSchema.parse({
    packageName: optStr(fd, "packageName"),
    price: parseRupiah(str(fd, "price")),
    includeItems: fd
      .getAll("includeItem")
      .map((v) => String(v).trim())
      .filter(Boolean),
    addons: readAddons(fd),
    notes: optStr(fd, "notes"),
    attachmentFileId: optStr(fd, "attachmentFileId"),
    dpCustom: custom,
    ...(custom ? readDp(fd) : { dpType: "percent", dpPercent: 30, dpAmount: 0 }),
  });
}

async function ownProspect(weddingId: string, id: string) {
  const [p] = await db.select().from(schema.prospect).where(and(eq(schema.prospect.id, id), eq(schema.prospect.weddingId, weddingId)));
  if (!p) throw new UserError("Calon vendor tidak ditemukan.");
  return p;
}

async function ownPackage(weddingId: string, id: string) {
  const [row] = await db
    .select({ pkg: schema.offer, prospect: schema.prospect })
    .from(schema.offer)
    .innerJoin(schema.prospect, eq(schema.offer.prospectId, schema.prospect.id))
    .where(and(eq(schema.offer.id, id), eq(schema.offer.weddingId, weddingId)));
  if (!row) throw new UserError("Paket tidak ditemukan.");
  return row;
}

/** Calon vendor baru beserta paket pertamanya. */
export async function addProspect(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const p = parseProspect(fd);
    const pkg = parsePackage(fd, false);
    await ownCategory(ctx.wedding.id, p.categoryId);
    await ownFile(ctx.wedding.id, pkg.attachmentFileId);
    await db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      await tx.insert(schema.prospect).values({ ...p, id, weddingId: ctx.wedding.id });
      await tx.insert(schema.offer).values({ ...pkg, prospectId: id, weddingId: ctx.wedding.id });
    });
    done();
  });
}

/** Info calon vendor. Pindah kategori membawa semua paketnya. */
export async function updateProspect(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    await ownProspect(ctx.wedding.id, id);
    const p = parseProspect(fd);
    await ownCategory(ctx.wedding.id, p.categoryId);
    await db.update(schema.prospect).set(p).where(eq(schema.prospect.id, id));
    done();
  });
}

/** Hapus calon vendor dan semua paketnya. Vendor yang sudah dipesan dari paketnya tetap ada. */
export async function deleteProspect(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    await db.delete(schema.prospect).where(and(eq(schema.prospect.id, id), eq(schema.prospect.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function addPackage(prospectId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    await ownProspect(ctx.wedding.id, prospectId);
    const pkg = parsePackage(fd, true);
    await ownFile(ctx.wedding.id, pkg.attachmentFileId);
    await db.insert(schema.offer).values({ ...pkg, prospectId, weddingId: ctx.wedding.id });
    done();
  });
}

export async function updatePackage(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    await ownPackage(ctx.wedding.id, id);
    const pkg = parsePackage(fd, true);
    await ownFile(ctx.wedding.id, pkg.attachmentFileId);
    await db.update(schema.offer).set(pkg).where(eq(schema.offer.id, id));
    done();
  });
}

/** Salin paket, misalnya untuk membuat Gold dari Silver lalu mengubah bedanya saja. */
export async function duplicatePackage(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const { pkg } = await ownPackage(ctx.wedding.id, id);
    await db.insert(schema.offer).values({
      ...pkg,
      id: crypto.randomUUID(),
      packageName: `${pkg.packageName || "Paket"} (salinan)`.slice(0, 80),
      status: "dibandingkan",
      createdAt: new Date(),
    });
    done();
    return "Paket disalin. Ubah nama dan isinya lewat tombol Ubah di kolom paket itu.";
  });
}

/** Hapus satu paket. Paket terakhir menghapus calon vendornya juga, supaya tidak ada vendor tanpa paket. */
export async function deletePackage(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const { pkg, prospect } = await ownPackage(ctx.wedding.id, id);
    const siblings = await db.select({ id: schema.offer.id }).from(schema.offer).where(eq(schema.offer.prospectId, prospect.id));
    if (siblings.length <= 1) await db.delete(schema.prospect).where(eq(schema.prospect.id, prospect.id));
    else await db.delete(schema.offer).where(eq(schema.offer.id, pkg.id));
    done();
  });
}

export async function trackCompare(categoryId: string) {
  const ctx = await requireAction("vendor", "view");
  track("offer_compared", { weddingId: ctx.wedding.id, role: ctx.member.role });
  void categoryId;
}

/**
 * Memilih paket: paket menjadi vendor terpesan (nama dan kontak dari calon vendornya), lalu termin
 * DP (dan pelunasan sisa bila ada) dibuat di Budget. DP memakai DP paket bila diatur sendiri.
 */
export async function chooseOffer(offerId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const { pkg: o, prospect: p } = await ownPackage(ctx.wedding.id, offerId);
    if (o.status === "dipilih") throw new UserError("Paket ini sudah dipilih.");
    const dpDue = isoDate.parse(str(fd, "dpDue") || addDays(todayISO(), 7));
    const settleDue = isoDate.parse(str(fd, "settleDue") || addDays(ctx.wedding.akadDate, -14));
    // DP dan pelunasan dihitung dari total paket + add-on.
    const dpInput = effectiveDp(o, p);
    const total = offerTotal(o);
    const dp = dpValue(dpInput);
    const rest = total - dp;

    await db.transaction(async (tx) => {
      // Satu kategori satu paket terpilih: kembalikan pilihan lain di kategori ini ke status dibandingkan.
      const sameCategory = tx.select({ id: schema.prospect.id }).from(schema.prospect).where(eq(schema.prospect.categoryId, p.categoryId));
      await tx
        .update(schema.offer)
        .set({ status: "dibandingkan" })
        .where(and(inArray(schema.offer.prospectId, sameCategory), ne(schema.offer.id, o.id)));
      await tx.update(schema.offer).set({ status: "dipilih" }).where(eq(schema.offer.id, o.id));
      const vendorId = crypto.randomUUID();
      await tx.insert(schema.vendor).values({
        id: vendorId,
        weddingId: ctx.wedding.id,
        categoryId: p.categoryId,
        offerId: o.id,
        name: p.name,
        packageName: o.packageName,
        packagePrice: o.price,
        includeItems: o.includeItems,
        addons: o.addons,
        packageDesc: [o.notes, p.notes].filter(Boolean).join("\n") || null,
        contact: p.contact,
        totalPrice: total,
      });
      const terms = [];
      if (dp > 0) terms.push({ label: dpLabel(dpInput), amount: dp, dueDate: dpDue });
      if (rest > 0) terms.push({ label: "Pelunasan", amount: rest, dueDate: settleDue });
      if (terms.length) await tx.insert(schema.paymentTerm).values(terms.map((t) => ({ ...t, vendorId, weddingId: ctx.wedding.id })));
    });
    track("offer_chosen", { weddingId: ctx.wedding.id, role: ctx.member.role });
    done();
    return `${p.name}${o.packageName ? `, ${o.packageName},` : ""} tersimpan sebagai vendor. Termin DP sudah dijadwalkan di Budget.`;
  });
}

/**
 * Membatalkan pilihan: paket tetap ada di perbandingan, tetapi vendor terpesan dan termin
 * DP/pelunasannya dihapus. Pengeluaran yang sudah dibayar tetap tercatat di Budget.
 */
export async function cancelOffer(offerId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("vendor");
    const { pkg, prospect } = await ownPackage(ctx.wedding.id, offerId);
    await db.update(schema.offer).set({ status: "dibandingkan" }).where(eq(schema.offer.id, pkg.id));
    // Termin ikut terhapus lewat cascade.
    await db.delete(schema.vendor).where(and(eq(schema.vendor.offerId, pkg.id), eq(schema.vendor.weddingId, ctx.wedding.id)));
    done();
    return `Pesanan ${prospect.name} dibatalkan. Paketnya kembali ke daftar perbandingan.`;
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
