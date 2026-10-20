import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { describePerms, normalize, resolvePerms, roleName } from "./roles";

/** Cookie berisi token undangan terakhir yang dibuka, supaya undangan tidak hilang saat tamu mendaftar dulu. */
export const INVITE_COOKIE = "rukun_invite";

const valid = () => and(isNull(schema.invite.acceptedAt), gt(schema.invite.expiresAt, new Date()));

export async function findInvite(token: string) {
  const [row] = await db
    .select({ invite: schema.invite, wedding: schema.wedding })
    .from(schema.invite)
    .innerJoin(schema.wedding, eq(schema.invite.weddingId, schema.wedding.id))
    .where(and(eq(schema.invite.token, token), valid()));
  return row ?? null;
}

/**
 * Undangan yang menunggu untuk pengguna ini: dari cookie (link yang pernah dibuka)
 * atau undangan email yang ditujukan ke alamat emailnya.
 */
export async function pendingInviteFor(email: string) {
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  if (token && /^[a-f0-9]{32}$/.test(token)) {
    const row = await findInvite(token);
    if (row && (!row.invite.email || row.invite.email.toLowerCase() === email.toLowerCase())) return row;
  }
  const [byEmail] = await db
    .select({ invite: schema.invite, wedding: schema.wedding })
    .from(schema.invite)
    .innerJoin(schema.wedding, eq(schema.invite.weddingId, schema.wedding.id))
    .where(and(sql`lower(${schema.invite.email}) = ${email.toLowerCase()}`, valid()))
    .orderBy(desc(schema.invite.createdAt));
  return byEmail ?? null;
}

/** Nama dan ringkasan izin peran sebuah undangan, termasuk peran buatan sendiri milik pernikahan itu. */
export async function inviteRoleInfo(weddingId: string, key: string) {
  const saved = await db.select().from(schema.weddingRole).where(eq(schema.weddingRole.weddingId, weddingId));
  const roles = saved.map((r) => ({ key: r.key, name: r.name, perms: normalize(r.perms) }));
  return { name: roleName(key, roles), summary: describePerms(resolvePerms(key, null, roles)) };
}
