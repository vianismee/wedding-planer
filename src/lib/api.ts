import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { publish } from "@/lib/live";

/*
 * REST API v1 untuk situs undangan digital di luar Rukun. Panduan: doc/API.md.
 *
 * Dua jenis kunci:
 * - server  (rkn_sk_…): akses penuh data tamu. Hanya untuk backend, ditolak bila dipanggil dari browser.
 * - undangan (rkn_pk_…): aman ditaruh di JavaScript halaman undangan. Hanya membaca satu tamu lewat
 *   kodenya, mengirim RSVP, dan membaca ucapan. Tidak pernah mengembalikan nomor HP atau alamat.
 */

export type KeyKind = "server" | "undangan";
export type ApiKeyRow = typeof schema.apiKey.$inferSelect;

const PREFIX: Record<KeyKind, string> = { server: "rkn_sk_", undangan: "rkn_pk_" };
const LIMIT: Record<KeyKind, number> = { server: 300, undangan: 120 }; // permintaan per menit

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function newKey(kind: KeyKind) {
  const key = PREFIX[kind] + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), prefix: key.slice(0, 12) };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function cors(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Preflight browser tidak membawa kunci, jadi dijawab longgar. Pemeriksaan origin ada di permintaan aslinya. */
export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export type ApiCtx = { key: ApiKeyRow; weddingId: string; req: Request };

/**
 * Bungkus route handler: autentikasi kunci, rate limit, CORS, dan format galat seragam
 * `{ "error": { "code", "message" } }`. `need: "server"` menolak kunci undangan.
 */
export function handler<P = Record<string, string>>(
  need: "server" | "any",
  fn: (ctx: ApiCtx, params: P) => Promise<Response | unknown>,
) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const origin = req.headers.get("origin");
    let allowOrigin: string | null = null;
    try {
      const auth = req.headers.get("authorization");
      const raw = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : req.headers.get("x-api-key")?.trim();
      if (!raw) throw new ApiError(401, "unauthorized", "Sertakan kunci API di header Authorization: Bearer <kunci>.");
      const [key] = await db.select().from(schema.apiKey).where(eq(schema.apiKey.hash, hashKey(raw)));
      if (!key) throw new ApiError(401, "unauthorized", "Kunci API tidak dikenal atau sudah dihapus.");
      const kind = key.kind as KeyKind;

      if (origin) {
        if (kind === "server") throw new ApiError(403, "server_key_in_browser", "Kunci server tidak boleh dipakai dari browser. Pakai kunci undangan.");
        if (key.origins.length && !key.origins.includes(origin)) throw new ApiError(403, "origin_not_allowed", `Origin ${origin} tidak terdaftar untuk kunci ini.`);
        allowOrigin = origin;
      }
      if (need === "server" && kind !== "server") throw new ApiError(403, "forbidden", "Endpoint ini butuh kunci server.");

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
      if (!rateLimit(`api:${key.id}:${kind === "undangan" ? ip : ""}`, LIMIT[kind], 60_000)) {
        throw new ApiError(429, "rate_limited", "Terlalu banyak permintaan. Coba lagi dalam satu menit.");
      }
      if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
        await db.update(schema.apiKey).set({ lastUsedAt: new Date() }).where(eq(schema.apiKey.id, key.id));
      }

      const out = await fn({ key, weddingId: key.weddingId, req }, await route.params);
      if (req.method !== "GET") publish(key.weddingId);
      const res = out instanceof Response ? out : Response.json({ data: out });
      for (const [k, v] of Object.entries(cors(allowOrigin))) res.headers.set(k, v);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      let status = 500;
      let code = "server_error";
      let message = "Terjadi kesalahan di server.";
      if (e instanceof ApiError) ({ status, code, message } = e);
      else if (e instanceof ZodError) {
        status = 422;
        code = "validation_error";
        const i = e.issues[0];
        message = i ? `${i.path.join(".") || "body"}: ${i.message}` : "Data tidak valid.";
      } else console.error(e);
      return Response.json({ error: { code, message } }, { status, headers: { ...cors(allowOrigin ?? origin), "Cache-Control": "no-store" } });
    }
  };
}

export async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Body harus JSON yang valid dengan Content-Type: application/json.");
  }
}

export const notFound = (what = "Tamu") => new ApiError(404, "not_found", `${what} tidak ditemukan.`);
