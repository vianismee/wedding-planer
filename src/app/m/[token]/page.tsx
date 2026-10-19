import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { dateLong } from "@/lib/format";
import { MOOD_BOARDS } from "@/lib/moodboard";
import { moodFontVars } from "@/lib/mood-fonts";
import { MoodboardViewer } from "./viewer";

export const metadata: Metadata = { title: "Moodboard", robots: { index: false, follow: false } };

// Halaman baca-saja untuk vendor. Hanya memuat satu papan yang dibagikan beserta nama pasangan,
// tanggal akad, dan kota: tidak ada budget, tamu, dokumen, atau papan lain.
export default async function MoodboardSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`mood-share:${ip}`, 60, 60_000)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[720px] items-center p-4">
        <p className="rounded-[18px] bg-warn-bg p-5 text-[14px] font-semibold text-warn-fg">Terlalu banyak permintaan dari jaringan ini. Coba lagi dalam satu menit.</p>
      </main>
    );
  }
  if (!/^[a-f0-9]{24}$/.test(token)) notFound();

  const [row] = await db
    .select({ board: schema.moodboard, wedding: schema.wedding })
    .from(schema.moodboard)
    .innerJoin(schema.wedding, eq(schema.moodboard.weddingId, schema.wedding.id))
    .where(eq(schema.moodboard.shareToken, token));
  if (!row) notFound();
  const { board, wedding: w } = row;
  const name = MOOD_BOARDS.find((b) => b.id === board.board)?.name ?? "Moodboard";

  return (
    <main className={`flex h-dvh flex-col gap-3 p-3 ${moodFontVars}`}>
      <header className="on-ink flex flex-col gap-0.5 rounded-[22px] bg-ink px-5 py-4 text-white">
        <p className="text-[12px] font-semibold text-[#c9c8d6]">Moodboard {name}</p>
        <h1 className="text-[20px] font-extrabold leading-[1.25] tracking-[-0.02em] sm:text-[24px]">
          Pernikahan {w.groomName} dan {w.brideName}
        </h1>
        <p className="text-[13px] text-[#d9d8e4]">
          Akad {dateLong(w.akadDate)}, {w.city}. Halaman ini hanya untuk dilihat.
        </p>
      </header>
      <MoodboardViewer data={board.data} token={token} />
    </main>
  );
}
