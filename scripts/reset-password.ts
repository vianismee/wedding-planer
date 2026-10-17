// Reset kata sandi dari server, untuk pengguna yang terkunci di luar (aplikasi tidak mengirim email).
// Pemakaian: npm run user:password -- <email> <kata-sandi-baru>
import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "../src/db";
import { PASSWORD_MAX, PASSWORD_MIN, setUserPassword } from "../src/lib/password";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) throw new Error("Pemakaian: npm run user:password -- <email> <kata-sandi-baru>");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    throw new Error(`Kata sandi ${PASSWORD_MIN} sampai ${PASSWORD_MAX} karakter.`);
  await dbReady();
  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email.toLowerCase()));
  if (!u) throw new Error(`Tidak ada akun dengan email ${email}.`);
  await setUserPassword(u.id, password);
  // Semua sesi keluar, termasuk perangkat yang mungkin dipegang orang lain.
  await db.delete(schema.session).where(eq(schema.session.userId, u.id));
  console.log(`Kata sandi ${u.email} diganti. Semua sesi sudah keluar.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
