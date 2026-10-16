"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { track } from "@/lib/analytics";

const guestSchema = z.object({
  name: z.string().min(1, "Isi nama tamu.").max(120),
  note: z.string().max(160).nullable(),
  category: z.string().min(1).max(40),
  side: z.enum(["pria", "wanita"], { message: "Pilih pihak tamu." }),
  session: z.string().min(1).max(40),
  pax: z.number().int().min(1, "Jumlah orang minimal 1.").max(500),
  delivery: z.enum(["diantar", "whatsapp", "email", "pos"]),
  status: z.enum(["belum_kirim", "terkirim", "cek_jumlah"]),
  vip: z.boolean(),
});

function parseGuest(fd: FormData) {
  return guestSchema.parse({
    name: str(fd, "name"),
    note: optStr(fd, "note"),
    category: str(fd, "category") || "Lainnya",
    side: str(fd, "side"),
    session: str(fd, "session") || "Sesi 1",
    pax: Number(str(fd, "pax") || 1),
    delivery: str(fd, "delivery") || "diantar",
    status: str(fd, "status") || "belum_kirim",
    vip: fd.get("vip") === "on",
  });
}

function done() {
  revalidatePath("/tamu");
  revalidatePath("/dashboard");
}

async function activation(weddingId: string, role: string) {
  const rows = await db.select({ id: schema.guest.id }).from(schema.guest).where(eq(schema.guest.weddingId, weddingId));
  const events = await db.select({ id: schema.event.id }).from(schema.event).where(eq(schema.event.weddingId, weddingId));
  if (rows.length >= 20 && events.length >= 1) track("activation_reached", { weddingId, role, count: rows.length });
}

export async function addGuest(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("tamu");
    const data = parseGuest(fd);
    await db.insert(schema.guest).values({ ...data, weddingId: ctx.wedding.id, createdBy: ctx.user.id });
    await activation(ctx.wedding.id, ctx.member.role);
    done();
    return `${data.name} ditambahkan.`;
  });
}

export async function updateGuest(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("tamu");
    const [g] = await db
      .update(schema.guest)
      .set(parseGuest(fd))
      .where(and(eq(schema.guest.id, id), eq(schema.guest.weddingId, ctx.wedding.id)))
      .returning();
    if (!g) throw new UserError("Tamu tidak ditemukan.");
    done();
  });
}

export async function deleteGuest(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("tamu");
    await db.delete(schema.guest).where(and(eq(schema.guest.id, id), eq(schema.guest.weddingId, ctx.wedding.id)));
    done();
  });
}

export async function setGuestsStatus(ids: string[], status: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("tamu");
    const s = z.enum(["belum_kirim", "terkirim", "cek_jumlah"]).parse(status);
    if (ids.length === 0) return;
    await db
      .update(schema.guest)
      .set({ status: s })
      .where(and(eq(schema.guest.weddingId, ctx.wedding.id), inArray(schema.guest.id, ids.slice(0, 5000))));
    done();
  });
}

const importRow = z.object({
  name: z.string().min(1).max(120),
  note: z.string().max(160).nullable(),
  category: z.string().min(1).max(40),
  side: z.enum(["pria", "wanita"]),
  session: z.string().min(1).max(40),
  pax: z.number().int().min(1).max(500),
  delivery: z.enum(["diantar", "whatsapp", "email", "pos"]),
});

/** Import hasil pratinjau Excel/CSV. Baris sudah dibersihkan di klien, divalidasi ulang di sini. */
export async function importGuests(rows: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("tamu");
    const list = z.array(importRow).max(5000, "Maksimal 5.000 baris per import.").parse(rows);
    if (list.length === 0) throw new UserError("Tidak ada baris yang dipilih untuk diimport.");
    for (let i = 0; i < list.length; i += 500) {
      await db.insert(schema.guest).values(
        list.slice(i, i + 500).map((r) => ({ ...r, weddingId: ctx.wedding.id, createdBy: ctx.user.id })),
      );
    }
    track("guests_imported", { weddingId: ctx.wedding.id, role: ctx.member.role, count: list.length });
    await activation(ctx.wedding.id, ctx.member.role);
    done();
    return `${list.length} tamu berhasil diimport.`;
  });
}
