import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can, FILE_AREA } from "@/lib/roles";
import { readLocal, signedUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return new NextResponse("Perlu masuk", { status: 401 });
  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, id), eq(schema.file.weddingId, ctx.wedding.id)));
  if (!f) return new NextResponse("File tidak ditemukan", { status: 404 });
  if (!can(ctx.member.role, FILE_AREA[f.kind] ?? "dokumen")) return new NextResponse("Tidak diizinkan", { status: 403 });

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
