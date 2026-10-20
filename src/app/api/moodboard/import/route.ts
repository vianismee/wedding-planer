import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";
import { rateLimit } from "@/lib/rate-limit";
import { putObject } from "@/lib/storage";
import { download, LinkError, resolveLink } from "@/lib/link-import";

const body = z.object({ url: z.string().min(1).max(2000) });
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm" };

/**
 * Ambil foto dan video dari link (Instagram, Pinterest, atau situs lain) lalu simpan seperti unggahan
 * biasa. File belum masuk papan: klien menaruh kartu media lewat /api/moodboard/ops setelah ini.
 * Disalin ke penyimpanan sendiri karena link CDN Instagram dan Pinterest kedaluwarsa.
 */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Kamu perlu masuk dulu." }, { status: 401 });
  if (!can(ctx.member.role, "moodboard")) return NextResponse.json({ error: "Peranmu tidak boleh menambah ke moodboard." }, { status: 403 });
  if (!rateLimit(`mood-import:${ctx.user.id}`, 20, 60_000)) return NextResponse.json({ error: "Terlalu banyak link sekaligus. Tunggu sebentar." }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Tempel link terlebih dulu." }, { status: 400 });

  try {
    const found = await resolveLink(p.data.url);
    // Unduh berurutan: carousel sampai 20 file, jangan membuka 20 koneksi sekaligus ke CDN yang sama.
    const items = [];
    for (const [i, it] of found.items.entries()) {
      let file;
      try {
        file = await download(it);
      } catch (e) {
        // Satu file carousel gagal tidak menggagalkan yang lain, kecuali semuanya gagal.
        if (found.items.length === 1 || (i === found.items.length - 1 && !items.length)) throw e;
        continue;
      }
      const id = crypto.randomUUID();
      const key = `${ctx.wedding.id}/moodboard/${id}`;
      await putObject(key, file.body, file.mime);
      await db.insert(schema.file).values({
        id,
        weddingId: ctx.wedding.id,
        key,
        name: `${found.title.slice(0, 80) || "media"}-${i + 1}.${EXT[file.mime]}`,
        mime: file.mime,
        size: file.body.length,
        kind: "moodboard",
        uploadedBy: ctx.user.id,
      });
      items.push({ fileId: id, kind: file.kind, w: it.w, h: it.h });
    }
    return NextResponse.json({ title: found.title, items });
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      return NextResponse.json({ error: "Situsnya terlalu lama merespons. Coba lagi." }, { status: 504 });
    console.error(e);
    return NextResponse.json({ error: "Link ini tidak bisa diambil. Coba link lain atau unggah fotonya." }, { status: 502 });
  }
}
