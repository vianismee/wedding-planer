import { NextResponse } from "next/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";
import { deleteObject } from "@/lib/storage";
import { emitMood } from "@/lib/mood-live";
import { applyOps, EMPTY_BOARD, MOOD_BOARDS, type MoodOp } from "@/lib/moodboard";
import { boardId, dataSchema, opSchema } from "@/lib/moodboard-schema";

// Pesan batas papan ditulis dalam bahasa Indonesia di skema; pesan bawaan zod (bahasa Inggris) diganti umum.
const issue = (e: z.ZodError) => {
  const m = e.issues[0]?.message ?? "";
  return !m || m.startsWith("Invalid") || m.startsWith("Too ") ? "Perubahan tidak valid. Muat ulang halaman lalu coba lagi." : m;
};

async function auth() {
  const ctx = await getContext();
  if (!ctx) return { error: new NextResponse("Perlu masuk", { status: 401 }) };
  if (!can(ctx.member.role, "moodboard")) return { error: new NextResponse("Tidak diizinkan", { status: 403 }) };
  return { ctx };
}

/** Isi semua papan beserta revisinya, untuk sinkron ulang setelah koneksi putus. */
export async function GET() {
  const { ctx, error } = await auth();
  if (!ctx) return error;
  const rows = await db.select().from(schema.moodboard).where(eq(schema.moodboard.weddingId, ctx.wedding.id));
  const boards = Object.fromEntries(
    MOOD_BOARDS.map((b) => {
      const r = rows.find((x) => x.board === b.id);
      return [b.id, { data: r?.data ?? EMPTY_BOARD, rev: r?.rev ?? 0 }];
    }),
  );
  return NextResponse.json({ boards }, { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({
  board: boardId,
  clientId: z.string().regex(/^[\w-]{8,64}$/),
  ops: z.array(opSchema).min(1).max(1000),
});

/**
 * Terapkan sekumpulan operasi ke satu papan. Baris papan dikunci selama transaksi, jadi operasi dari
 * beberapa anggota diterapkan berurutan, lalu dikirim ke semua tab lewat /api/moodboard/live.
 */
export async function POST(req: Request) {
  const { ctx, error } = await auth();
  if (!ctx) return error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: issue(parsed.error) }, { status: 400 });
  const { board, clientId } = parsed.data;
  const ops = parsed.data.ops as MoodOp[];
  const weddingId = ctx.wedding.id;

  let rev = 0;
  try {
    await db.transaction(async (tx) => {
      const where = and(eq(schema.moodboard.weddingId, weddingId), eq(schema.moodboard.board, board));
      await tx.insert(schema.moodboard).values({ weddingId, board, data: EMPTY_BOARD, rev: 0 }).onConflictDoNothing();
      const [cur] = await tx.select({ data: schema.moodboard.data, rev: schema.moodboard.rev }).from(schema.moodboard).where(where).for("update");
      const next = dataSchema.parse(applyOps(cur.data, ops));
      // Sambungan ke kartu yang sudah dihapus anggota lain dibuang.
      const ids = new Set(next.nodes.map((n) => n.id));
      next.edges = next.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
      rev = cur.rev + 1;
      await tx.update(schema.moodboard).set({ data: next, rev, updatedBy: ctx.user.id, updatedAt: new Date() }).where(where);
    });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: issue(e) }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." }, { status: 500 });
  }

  emitMood(weddingId, { type: "ops", board, rev, clientId, ops });
  if (ops.some((o) => o.t === "del" || (o.t === "put" && o.c === "nodes" && (o.item.type === "photo" || o.item.type === "media")) || (o.t === "patch" && ("fileId" in o.set || "media" in o.set))))
    void cleanupPhotos(weddingId);
  return NextResponse.json({ rev });
}

const lastCleanup = new Map<string, number>();

/**
 * Hapus foto dan video moodboard yang sudah tidak dipakai di papan mana pun. Hanya foto yang lebih dari sehari,
 * supaya unggahan yang belum masuk papan aman, dan paling sering sekali per menit per pernikahan.
 */
async function cleanupPhotos(weddingId: string) {
  const now = Date.now();
  if ((lastCleanup.get(weddingId) ?? 0) > now - 60_000) return;
  lastCleanup.set(weddingId, now);
  try {
    const boards = await db.select({ data: schema.moodboard.data }).from(schema.moodboard).where(eq(schema.moodboard.weddingId, weddingId));
    const used = new Set(boards.flatMap((b) => b.data.nodes.flatMap((n) => [n.fileId, ...(n.media ?? []).map((m) => m.fileId)]).filter(Boolean)));
    const old = await db
      .select({ id: schema.file.id, key: schema.file.key })
      .from(schema.file)
      .where(and(eq(schema.file.weddingId, weddingId), eq(schema.file.kind, "moodboard"), lt(schema.file.createdAt, new Date(now - 86_400_000))));
    const unused = old.filter((f) => !used.has(f.id));
    if (!unused.length) return;
    await Promise.all(unused.map((f) => deleteObject(f.key)));
    await db.delete(schema.file).where(inArray(schema.file.id, unused.map((f) => f.id)));
  } catch (e) {
    console.error(e);
  }
}
