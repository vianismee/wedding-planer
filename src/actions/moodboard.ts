"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAction } from "@/lib/session";
import { run, type ActionResult } from "@/lib/action";
import { EMPTY_BOARD } from "@/lib/moodboard";
import { boardId } from "@/lib/moodboard-schema";

// Isi papan disimpan lewat /api/moodboard/ops (operasi per elemen, realtime), bukan server action:
// server action dari satu tab dijalankan berurutan, terlalu lambat untuk kursor dan geser kartu.

/** Membuat atau mencabut link baca-saja satu papan untuk vendor, tanpa login. */
export async function setMoodboardShare(board: string, enabled: boolean): Promise<ActionResult & { token?: string | null }> {
  let token: string | null = null;
  const r = await run(async () => {
    const ctx = await requireAction("moodboard");
    const b = boardId.parse(board);
    token = enabled ? crypto.randomUUID().replace(/-/g, "").slice(0, 24) : null;
    await db.insert(schema.moodboard).values({ weddingId: ctx.wedding.id, board: b, data: EMPTY_BOARD, rev: 0 }).onConflictDoNothing();
    await db
      .update(schema.moodboard)
      .set({ shareToken: token })
      .where(and(eq(schema.moodboard.weddingId, ctx.wedding.id), eq(schema.moodboard.board, b)));
    return enabled ? "Link untuk vendor dibuat." : "Link dicabut. Link lama tidak bisa dibuka lagi.";
  });
  return { ...r, token };
}
