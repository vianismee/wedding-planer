import "server-only";
import { ZodError } from "zod";
import { ForbiddenError } from "./session";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

export async function run(fn: () => Promise<void | string | { id: string; message?: string }>): Promise<ActionResult> {
  try {
    const r = await fn();
    if (typeof r === "string") return { ok: true, message: r };
    if (r && typeof r === "object") return { ok: true, ...r };
    return { ok: true };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Isian belum lengkap." };
    if (e instanceof ForbiddenError || e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." };
  }
}

/** Kesalahan yang pesannya aman ditampilkan ke pengguna. */
export class UserError extends Error {}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string) {
  return str(fd, key) || null;
}
