"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ForbiddenError, requireAction } from "@/lib/session";
import { can } from "@/lib/roles";
import { run, str, UserError, type ActionResult } from "@/lib/action";
import { newKey } from "@/lib/api";

const MAX_KEYS = 10;

/** Kunci API membuka data tamu, jadi butuh izin ubah Pengaturan dan Tamu sekaligus. */
async function manager() {
  const ctx = await requireAction("pengaturan");
  if (!can(ctx.perms, "tamu", "edit")) throw new ForbiddenError("Butuh izin ubah daftar tamu untuk mengelola kunci API.");
  return ctx;
}

const origin = z
  .string()
  .transform((s) => s.trim().replace(/\/+$/, ""))
  .pipe(z.string().regex(/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i, "Origin harus seperti https://undangan.contoh.com, tanpa path."));

const keySchema = z.object({
  name: z.string().min(1, "Isi nama kunci.").max(60),
  kind: z.enum(["server", "undangan"]),
  origins: z.array(origin).max(10, "Maksimal 10 origin."),
});

/** Membuat kunci baru. Kunci utuh dikembalikan di `message` dan hanya tampil sekali. */
export async function createApiKey(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await manager();
    const input = keySchema.parse({
      name: str(fd, "name"),
      kind: str(fd, "kind"),
      origins: str(fd, "origins")
        .split(/[\s,]+/)
        .filter(Boolean),
    });
    const existing = await db.select({ id: schema.apiKey.id }).from(schema.apiKey).where(eq(schema.apiKey.weddingId, ctx.wedding.id));
    if (existing.length >= MAX_KEYS) throw new UserError(`Maksimal ${MAX_KEYS} kunci. Hapus kunci yang tidak dipakai.`);
    const k = newKey(input.kind);
    const [row] = await db
      .insert(schema.apiKey)
      .values({
        weddingId: ctx.wedding.id,
        name: input.name,
        kind: input.kind,
        prefix: k.prefix,
        hash: k.hash,
        origins: input.kind === "undangan" ? input.origins : [],
        createdBy: ctx.user.id,
      })
      .returning({ id: schema.apiKey.id });
    revalidatePath("/pengaturan");
    return { id: row.id, message: k.key };
  });
}

export async function deleteApiKey(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await manager();
    await db.delete(schema.apiKey).where(and(eq(schema.apiKey.id, id), eq(schema.apiKey.weddingId, ctx.wedding.id)));
    revalidatePath("/pengaturan");
    return "Kunci dihapus. Aplikasi yang memakainya tidak bisa terhubung lagi.";
  });
}

const urlSchema = z
  .string()
  .max(300)
  .refine((s) => !s || /^https?:\/\/\S+$/i.test(s), "Link harus diawali https://.")
  .transform((s) => s || null);

/** Pola link undangan digital, misalnya https://undangan.id/rina-dimas?to={kode}. */
export async function updateInvitationUrl(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await manager();
    const url = urlSchema.parse(str(fd, "invitationUrl"));
    await db.update(schema.wedding).set({ invitationUrl: url }).where(eq(schema.wedding.id, ctx.wedding.id));
    revalidatePath("/pengaturan");
    revalidatePath("/tamu");
    return "Link undangan tersimpan.";
  });
}
