import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { readLocal, signedUrl } from "@/lib/storage";

/** Foto untuk link moodboard vendor: hanya foto yang memang ada di papan yang dibagikan. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(`mood-photo:${ip}`, 600, 60_000)) return new NextResponse("Terlalu banyak permintaan", { status: 429 });
  if (!/^[a-f0-9]{24}$/.test(token)) return new NextResponse("Tidak ditemukan", { status: 404 });

  const [board] = await db
    .select({ weddingId: schema.moodboard.weddingId, data: schema.moodboard.data })
    .from(schema.moodboard)
    .where(eq(schema.moodboard.shareToken, token));
  if (!board || !board.data.nodes.some((n) => n.type === "photo" && n.fileId === id)) return new NextResponse("Tidak ditemukan", { status: 404 });

  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, id), eq(schema.file.weddingId, board.weddingId), eq(schema.file.kind, "moodboard")));
  if (!f) return new NextResponse("Tidak ditemukan", { status: 404 });

  const url = await signedUrl(f.key, f.name);
  if (url) return NextResponse.redirect(url);
  const body = await readLocal(f.key);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(f.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
