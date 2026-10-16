import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

type Holder = { db?: DB; ready?: Promise<void> };
// Disimpan di globalThis supaya HMR dan beberapa module graph di dev memakai satu koneksi.
const g = globalThis as unknown as { __rukunDb?: Holder };
const holder: Holder = (g.__rukunDb ??= {});

const MIGRATIONS = path.join(process.cwd(), "drizzle");

function create(): DB {
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    const db = drizzle({ client: pool, schema });
    // Migrasi dijalankan saat server start (satu instance app, sesuai arsitektur 1 VPS).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/node-postgres/migrator") as typeof import("drizzle-orm/node-postgres/migrator");
    holder.ready = migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const dir = path.join(process.cwd(), ".data", "pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require("node:fs") as typeof import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle({ client, schema });
  // PGlite dipakai untuk development: migrasi dijalankan otomatis saat pertama dibuka.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate } = require("drizzle-orm/pglite/migrator") as typeof import("drizzle-orm/pglite/migrator");
  holder.ready = migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

function getDb(): DB {
  return (holder.db ??= create());
}

/** Menunggu migrasi selesai (dipanggil dari instrumentation saat server start). */
export async function dbReady() {
  getDb();
  await holder.ready;
}

// Dibuat lazy supaya build tidak membuka database.
export const db = new Proxy({} as DB, {
  get(_, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
