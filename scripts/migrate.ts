// Menjalankan migrasi Drizzle ke DATABASE_URL (Postgres) atau ke PGlite lokal.
import { dbReady } from "../src/db";

async function main() {
  await dbReady();
  console.log("Migrasi selesai");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
