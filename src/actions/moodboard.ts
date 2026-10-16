"use server";

import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { run, UserError, type ActionResult } from "@/lib/action";
import { deleteObject } from "@/lib/storage";
import { MOOD_BOARDS, MOOD_GROUP_COLORS, MOOD_LIMITS, MOOD_TAG_MAX } from "@/lib/moodboard";

const coord = z.number().finite().min(-100_000).max(100_000);
const id = z.string().min(1).max(64);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const dataSchema = z.object({
  nodes: z
    .array(
      z.object({
        id,
        type: z.enum(["photo", "note", "palette"]),
        x: coord,
        y: coord,
        title: z.string().max(120),
        text: z.string().max(2000).optional(),
        fileId: z.uuid().optional(),
        fit: z.enum(["cover", "contain"]).optional(),
        focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
        swatches: z.array(hex).max(MOOD_LIMITS.swatches).optional(),
        tags: z.array(z.string().trim().min(1).max(MOOD_TAG_MAX)).max(MOOD_LIMITS.tags),
      }),
    )
    .max(MOOD_LIMITS.nodes, `Maksimal ${MOOD_LIMITS.nodes} kartu per papan.`),
  edges: z.array(z.object({ id, from: id, to: id, label: z.string().max(80) })).max(MOOD_LIMITS.edges),
  groups: z
    .array(
      z.object({
        id,
        x: coord,
        y: coord,
        w: z.number().min(240).max(20_000),
        h: z.number().min(140).max(20_000),
        title: z.string().max(80),
        color: z.enum(Object.keys(MOOD_GROUP_COLORS) as [string, ...string[]]),
      }),
    )
    .max(MOOD_LIMITS.groups, `Maksimal ${MOOD_LIMITS.groups} kelompok per papan.`),
});

const boardId = z.enum(MOOD_BOARDS.map((b) => b.id) as [string, ...string[]]);

export type SaveResult = ActionResult & { rev?: number; conflict?: boolean };

/**
 * Simpan seluruh isi satu papan. `baseRev` adalah revisi yang terakhir dimuat klien:
 * bila anggota lain sudah menyimpan lebih dulu, simpanan ditolak, bukan menimpa.
 */
export async function saveMoodboard(board: string, baseRev: number, data: unknown): Promise<SaveResult> {
  let rev = 0;
  let conflict = false;
  const r = await run(async () => {
    const ctx = await requireAction("moodboard");
    const b = boardId.parse(board);
    const d = dataSchema.parse(data);
    const ids = new Set(d.nodes.map((n) => n.id));
    d.edges = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to));

    const where = and(eq(schema.moodboard.weddingId, ctx.wedding.id), eq(schema.moodboard.board, b));
    const [cur] = await db.select({ rev: schema.moodboard.rev }).from(schema.moodboard).where(where);
    if (!cur) {
      await db.insert(schema.moodboard).values({ weddingId: ctx.wedding.id, board: b, data: d, rev: 1, updatedBy: ctx.user.id });
      rev = 1;
    } else {
      const updated = await db
        .update(schema.moodboard)
        .set({ data: d, rev: cur.rev + 1, updatedBy: ctx.user.id, updatedAt: new Date() })
        .where(and(where, eq(schema.moodboard.rev, baseRev)))
        .returning({ rev: schema.moodboard.rev });
      if (!updated.length) {
        conflict = true;
        throw new UserError("Papan ini baru diubah anggota lain. Muat ulang halaman untuk melihat versi terbaru.");
      }
      rev = updated[0].rev;
    }
    await cleanupPhotos(ctx.wedding.id);
  });
  return { ...r, rev, conflict };
}

/** Hapus foto moodboard yang sudah tidak dipakai di papan mana pun (lebih dari sehari, supaya unggahan yang belum tersimpan aman). */
async function cleanupPhotos(weddingId: string) {
  const boards = await db.select({ data: schema.moodboard.data }).from(schema.moodboard).where(eq(schema.moodboard.weddingId, weddingId));
  const used = new Set(boards.flatMap((b) => b.data.nodes.map((n) => n.fileId).filter(Boolean)));
  const old = await db
    .select({ id: schema.file.id, key: schema.file.key })
    .from(schema.file)
    .where(
      and(
        eq(schema.file.weddingId, weddingId),
        eq(schema.file.kind, "moodboard"),
        lt(schema.file.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  const unused = old.filter((f) => !used.has(f.id));
  if (!unused.length) return;
  await Promise.all(unused.map((f) => deleteObject(f.key)));
  await db.delete(schema.file).where(inArray(schema.file.id, unused.map((f) => f.id)));
}
