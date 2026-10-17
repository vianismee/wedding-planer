import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, schema } from "../db";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/**
 * Menyimpan kata sandi baru untuk akun email + kata sandi. Akun yang dibuat lewat kode email
 * atau Google belum punya baris credential, jadi dibuat di sini.
 */
export async function setUserPassword(userId: string, password: string) {
  const hash = await hashPassword(password);
  const where = and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential"));
  const updated = await db.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(where).returning({ id: schema.account.id });
  if (!updated.length)
    await db.insert(schema.account).values({ id: crypto.randomUUID(), userId, accountId: userId, providerId: "credential", password: hash });
}
