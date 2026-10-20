import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, schema } from "@/db";
import { can, homeFor, normalize, resolvePerms, type Area, type Perms, type RoleDef } from "./roles";

export const WEDDING_COOKIE = "rukun_wedding";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/masuk");
  return session.user;
}

export type Ctx = {
  user: { id: string; name: string; email: string };
  wedding: schema.Wedding;
  member: schema.Member;
  // Izin akhir anggota ini (peran ditambah pengecualian pribadinya), dan peran yang disimpan untuk pernikahan ini.
  perms: Perms;
  roles: RoleDef[];
};

/** Ruang pernikahan aktif untuk pengguna ini, atau null bila belum punya. */
export const getContext = cache(async (): Promise<Ctx | null> => {
  const session = await getSession();
  if (!session) return null;
  const preferred = (await cookies()).get(WEDDING_COOKIE)?.value;

  const rows = await db
    .select({ member: schema.member, wedding: schema.wedding })
    .from(schema.member)
    .innerJoin(schema.wedding, eq(schema.member.weddingId, schema.wedding.id))
    .where(eq(schema.member.userId, session.user.id))
    .orderBy(asc(schema.member.createdAt));
  if (rows.length === 0) return null;
  const row = rows.find((r) => r.wedding.id === preferred) ?? rows[0];
  const saved = await db.select().from(schema.weddingRole).where(eq(schema.weddingRole.weddingId, row.wedding.id));
  const roles = saved.map((r) => ({ key: r.key, name: r.name, perms: normalize(r.perms) }));
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    wedding: row.wedding,
    member: row.member,
    perms: resolvePerms(row.member.role, row.member.perms, roles),
    roles,
  };
});

/**
 * Untuk halaman: arahkan ke login/onboarding bila perlu, dan ke halaman lain yang boleh dibuka bila
 * izinnya "Tidak ada". Tanpa `area`, cukup jadi anggota (dipakai Pengaturan untuk akun pribadi).
 */
export async function requirePage(area?: Area): Promise<Ctx> {
  const session = await getSession();
  if (!session) redirect("/masuk");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");
  if (area && !can(ctx.perms, area)) redirect(homeFor(ctx.perms));
  return ctx;
}

export class ForbiddenError extends Error {}

/**
 * Untuk server action dan route handler yang mengubah data: butuh izin "Ubah". Selalu dicek di
 * server, tidak hanya dengan menyembunyikan tombol di UI.
 */
export async function requireAction(area: Area, need: "view" | "edit" = "edit"): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) throw new ForbiddenError("Kamu belum masuk atau belum punya ruang pernikahan.");
  if (!can(ctx.perms, area, need))
    throw new ForbiddenError(can(ctx.perms, area) ? "Kamu hanya bisa melihat bagian ini, tidak mengubahnya." : "Kamu tidak punya akses ke bagian ini.");
  return ctx;
}

export async function isMember(weddingId: string, userId: string) {
  const [m] = await db
    .select()
    .from(schema.member)
    .where(and(eq(schema.member.weddingId, weddingId), eq(schema.member.userId, userId)));
  return m ?? null;
}
