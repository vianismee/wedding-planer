"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSession, isMember, requireAction, WEDDING_COOKIE } from "@/lib/session";
import { run, str, UserError, type ActionResult } from "@/lib/action";
import { addDays, diffDays, parseRupiah, todayISO } from "@/lib/format";
import {
  buildDocuments,
  buildEvents,
  buildSeserahan,
  buildTasks,
  DEFAULT_BUDGET,
  officeFor,
  type TemplateId,
} from "@/lib/templates";
import { track } from "@/lib/analytics";

const tpl = z.enum(["jawa", "sunda", "nasional", "kosong"], { message: "Pilih template adat." });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal akad.");

const onboardingSchema = z.object({
  userName: z.string().min(1, "Isi nama kamu.").max(80),
  groomName: z.string().min(1, "Isi nama calon pengantin pria.").max(60),
  brideName: z.string().min(1, "Isi nama calon pengantin wanita.").max(60),
  akadDate: isoDate,
  city: z.string().min(1, "Isi kota akad.").max(80),
  akadTemplate: tpl,
  resepsiTemplate: tpl,
  religion: z.string().min(1),
  budget: z.number().min(0),
  sameDay: z.boolean(),
});

export async function createWedding(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const session = await getSession();
    if (!session) throw new UserError("Sesi berakhir. Silakan masuk lagi.");
    const input = onboardingSchema.parse({
      userName: str(fd, "userName"),
      groomName: str(fd, "groomName"),
      brideName: str(fd, "brideName"),
      akadDate: str(fd, "akadDate"),
      city: str(fd, "city"),
      akadTemplate: str(fd, "akadTemplate"),
      resepsiTemplate: str(fd, "resepsiTemplate"),
      religion: str(fd, "religion") || "islam",
      budget: parseRupiah(str(fd, "budget")),
      sameDay: str(fd, "sameDay") === "1",
    });

    const weddingId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.update(schema.user).set({ name: input.userName }).where(eq(schema.user.id, session.user.id));
      await tx.insert(schema.wedding).values({
        id: weddingId,
        groomName: input.groomName,
        brideName: input.brideName,
        akadDate: input.akadDate,
        city: input.city,
        akadTemplate: input.akadTemplate,
        resepsiTemplate: input.resepsiTemplate,
        religion: input.religion,
        officeName: `${officeFor(input.religion)} ${input.city}`,
        createdBy: session.user.id,
      });
      await tx.insert(schema.member).values({ weddingId, userId: session.user.id, role: "pemilik" });
      await seedWedding(tx, weddingId, input);
    });

    (await cookies()).set(WEDDING_COOKIE, weddingId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    track("wedding_created", { weddingId, role: "pemilik" });
    return { id: weddingId };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedWedding(
  tx: Tx,
  weddingId: string,
  input: { akadDate: string; akadTemplate: TemplateId; resepsiTemplate: TemplateId; religion: string; budget: number; sameDay: boolean },
) {
  const events = buildEvents(input.akadTemplate, input.resepsiTemplate, input.sameDay);
  for (const [i, e] of events.entries()) {
    const eventId = crypto.randomUUID();
    await tx.insert(schema.event).values({
      id: eventId,
      weddingId,
      name: e.name,
      kind: e.kind,
      date: addDays(input.akadDate, e.offset),
      startTime: e.time,
      location: e.location,
      estimatedGuests: e.guests,
      sortOrder: i,
    });
    if (e.rundown?.length) {
      await tx.insert(schema.rundownItem).values(
        e.rundown.map(([time, activity, pic], j) => ({ weddingId, eventId, time, activity, pic, sortOrder: j })),
      );
    }
  }

  // Bila sisa waktu lebih pendek dari jadwal template, tenggat dimampatkan supaya tidak ada tugas
  // yang langsung terlambat. Tugas H-7 ke bawah tidak digeser.
  const empty = input.akadTemplate === "kosong";
  if (empty) return;

  const tasks = buildTasks(input.akadTemplate, input.resepsiTemplate);
  const longest = Math.max(...tasks.map(([, , o]) => -o));
  const daysLeft = diffDays(todayISO(), input.akadDate);
  const scale = daysLeft >= longest ? 1 : Math.max(0, (daysLeft - 1) / longest);
  await tx.insert(schema.task).values(
    tasks.map(([title, pic, offsetDays]) => ({
      weddingId,
      title,
      pic,
      offsetDays: offsetDays >= -7 ? offsetDays : Math.min(-8, Math.round(offsetDays * scale)),
    })),
  );

  await tx.insert(schema.seserahanItem).values(
    buildSeserahan(input.akadTemplate).map(([category, name], i) => ({ weddingId, category, name, sortOrder: i })),
  );

  // Dibulatkan per Rp 100 rb; sisa pembulatan masuk ke kategori terakhir supaya totalnya pas.
  const allocations = DEFAULT_BUDGET.map(([, share]) => Math.round((input.budget * share) / 100_000) * 100_000);
  allocations[allocations.length - 1] += input.budget - allocations.reduce((s, a) => s + a, 0);
  await tx.insert(schema.budgetCategory).values(
    DEFAULT_BUDGET.map(([name], i) => ({ weddingId, name, allocation: Math.max(0, allocations[i]), sortOrder: i })),
  );

  const docs = buildDocuments(input.religion);
  await tx.insert(schema.document).values(
    (["pria", "wanita"] as const).flatMap((person) =>
      docs.map((name, i) => ({ weddingId, person, name, sortOrder: i })),
    ),
  );
}

/* ---------- Pengaturan ---------- */

const settingsSchema = z.object({
  groomName: z.string().min(1, "Isi nama calon pengantin pria.").max(60),
  brideName: z.string().min(1, "Isi nama calon pengantin wanita.").max(60),
  akadDate: isoDate,
  city: z.string().min(1, "Isi kota.").max(80),
  religion: z.string().min(1),
  officeName: z.string().max(120),
  accent: z.enum(["#D6F06B", "#F6C9D0", "#BFE3CF", "#F5D78E"]),
  quotaGroom: z.number().int().min(0).max(100_000),
  quotaBride: z.number().int().min(0).max(100_000),
});

export async function updateWedding(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const input = settingsSchema.parse({
      groomName: str(fd, "groomName"),
      brideName: str(fd, "brideName"),
      akadDate: str(fd, "akadDate"),
      city: str(fd, "city"),
      religion: str(fd, "religion"),
      officeName: str(fd, "officeName"),
      accent: str(fd, "accent"),
      quotaGroom: Number(str(fd, "quotaGroom") || 0),
      quotaBride: Number(str(fd, "quotaBride") || 0),
    });
    const old = ctx.wedding;
    await db.transaction(async (tx) => {
      await tx.update(schema.wedding).set(input).where(eq(schema.wedding.id, old.id));
      // Tenggat checklist tersimpan relatif ke akad, jadi otomatis ikut bergeser.
      // Tanggal acara juga digeser dengan selisih yang sama.
      if (input.akadDate !== old.akadDate) {
        const events = await tx.select().from(schema.event).where(eq(schema.event.weddingId, old.id));
        const shift = Math.round((Date.parse(input.akadDate) - Date.parse(old.akadDate)) / 86_400_000);
        for (const e of events) {
          if (e.date && e.status !== "selesai")
            await tx.update(schema.event).set({ date: addDays(e.date, shift) }).where(eq(schema.event.id, e.id));
        }
      }
      if (input.religion !== old.religion) {
        // Jalur dokumen berubah: ganti daftar dokumen yang belum punya file.
        const docs = await tx.select().from(schema.document).where(eq(schema.document.weddingId, old.id));
        for (const d of docs) if (!d.fileId && d.status === "belum") await tx.delete(schema.document).where(eq(schema.document.id, d.id));
        const kept = new Set(docs.filter((d) => d.fileId || d.status !== "belum").map((d) => `${d.person}:${d.name}`));
        const names = buildDocuments(input.religion);
        const rows = (["pria", "wanita"] as const).flatMap((person) =>
          names.filter((n) => !kept.has(`${person}:${n}`)).map((name, i) => ({ weddingId: old.id, person, name, sortOrder: 100 + i })),
        );
        if (rows.length) await tx.insert(schema.document).values(rows);
      }
    });
    revalidatePath("/", "layout");
    return "Pengaturan tersimpan.";
  });
}

export async function switchWedding(weddingId: string): Promise<ActionResult> {
  return run(async () => {
    const session = await getSession();
    if (!session) throw new UserError("Sesi berakhir.");
    const m = await isMember(weddingId, session.user.id);
    if (!m) throw new UserError("Ruang pernikahan tidak ditemukan.");
    (await cookies()).set(WEDDING_COOKIE, weddingId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
  });
}

/** Hapus permanen ruang pernikahan beserta semua data dan file (permintaan hapus data, UU PDP). */
export async function deleteWedding(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    if (ctx.member.role !== "pemilik") throw new UserError("Hanya pemilik yang bisa menghapus ruang pernikahan.");
    const expected = `${ctx.wedding.groomName} & ${ctx.wedding.brideName}`;
    if (str(fd, "confirm") !== expected) throw new UserError(`Ketik "${expected}" untuk konfirmasi.`);
    const files = await db.select().from(schema.file).where(eq(schema.file.weddingId, ctx.wedding.id));
    const { deleteObject } = await import("@/lib/storage");
    for (const f of files) await deleteObject(f.key).catch(() => {});
    await db.delete(schema.wedding).where(eq(schema.wedding.id, ctx.wedding.id));
    (await cookies()).delete(WEDDING_COOKIE);
    revalidatePath("/", "layout");
  });
}
