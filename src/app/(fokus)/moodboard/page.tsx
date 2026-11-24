import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can } from "@/lib/roles";
import { MOOD_BOARDS, type MoodBoardId } from "@/lib/moodboard";
import { moodFontVars } from "@/lib/mood-fonts";
import { MoodboardCanvas } from "./canvas";
import { MoodboardMobile } from "./mobile";
import { MoodboardReadOnly } from "./read-only";
import { ViewSwitch } from "./view-switch";

export const metadata: Metadata = { title: "Moodboard" };

/** Link pertama dari data "Bagikan" (Android): Instagram menaruh link post di `text`, bukan di `url`. */
function sharedLink(sp: Record<string, string | string[] | undefined>) {
  const all = ["url", "text", "title"].map((k) => sp[k]).flat().filter(Boolean).join(" ");
  return all.match(/https?:\/\/\S+/)?.[0] ?? null;
}

export default async function MoodboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePage("moodboard");
  const rows = await db.select().from(schema.moodboard).where(eq(schema.moodboard.weddingId, ctx.wedding.id));
  const edit = can(ctx.perms, "moodboard", "edit");

  const data = {} as Record<MoodBoardId, schema.MoodData>;
  const rev = {} as Record<MoodBoardId, number>;
  const share = {} as Record<MoodBoardId, string | null>;
  for (const b of MOOD_BOARDS) {
    const row = rows.find((r) => r.board === b.id);
    data[b.id] = row?.data ?? { nodes: [], edges: [], groups: [] };
    rev[b.id] = row?.rev ?? 0;
    share[b.id] = row?.shareToken ?? null;
  }

  return (
    <ViewSwitch
      wide={
        <div className={`h-[calc(100dvh-24px)] min-h-[520px] ${moodFontVars}`}>
          {edit ? (
            <MoodboardCanvas initial={data} initialRev={rev} initialShare={share} me={{ id: ctx.user.id, name: ctx.user.name }} />
          ) : (
            <MoodboardReadOnly boards={data} />
          )}
        </div>
      }
      narrow={<MoodboardMobile initial={data} edit={edit} shared={edit ? sharedLink(await searchParams) : null} />}
    />
  );
}
