import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { MOOD_BOARDS, type MoodBoardId } from "@/lib/moodboard";
import { LinkButton } from "@/components/kit";
import { MoodboardCanvas } from "./canvas";

export const metadata: Metadata = { title: "Moodboard" };

export default async function MoodboardPage() {
  const ctx = await requirePage("moodboard");
  const rows = await db.select().from(schema.moodboard).where(eq(schema.moodboard.weddingId, ctx.wedding.id));

  const data = {} as Record<MoodBoardId, schema.MoodData>;
  const rev = {} as Record<MoodBoardId, number>;
  for (const b of MOOD_BOARDS) {
    const row = rows.find((r) => r.board === b.id);
    data[b.id] = row?.data ?? { nodes: [], edges: [], groups: [] };
    rev[b.id] = row?.rev ?? 0;
  }

  return (
    <>
      {/* Menyusun dan menyambung foto butuh layar lebar: di HP hanya tampil penjelasan. */}
      <section className="flex flex-col items-start gap-2 rounded-[22px] bg-surface p-6 min-[768px]:hidden">
        <h1 className="text-[22px] font-extrabold">Moodboard dibuka di tablet atau laptop</h1>
        <p className="text-[14px] text-muted">
          Menyusun dan menyambung foto referensi butuh layar yang lebih lebar. Buka halaman ini dari tablet atau browser di laptop.
        </p>
        <LinkButton href="/dashboard" variant="ground" className="mt-2">
          Kembali ke beranda
        </LinkButton>
      </section>
      <div className="hidden h-[calc(100dvh-24px)] min-h-[520px] min-[768px]:block">
        <MoodboardCanvas initial={data} initialRev={rev} />
      </div>
    </>
  );
}
