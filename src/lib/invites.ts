import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

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
