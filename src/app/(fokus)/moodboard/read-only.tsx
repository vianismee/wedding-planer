"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { MoodData } from "@/db/schema";
import { MOOD_BOARDS, type MoodBoardId } from "@/lib/moodboard";
import { cx, ViewOnly } from "@/components/kit";
import { MoodboardViewer } from "@/app/m/[token]/viewer";

/**
 * Moodboard untuk anggota yang hanya boleh melihat: tiga papan bisa dipilih, digeser, di-zoom, dan
 * fotonya dibuka penuh, tanpa alat edit. Memakai tampilan yang sama dengan link untuk vendor.
 */
export function MoodboardReadOnly({ boards }: { boards: Record<MoodBoardId, MoodData> }) {
  const [active, setActive] = useState<MoodBoardId>("utama");
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <Link
          href="/dashboard"
          className="-ml-1 inline-flex h-11 items-center gap-1.5 rounded-xl pl-2 pr-3 text-[13px] font-bold text-muted no-underline hover:bg-ground hover:text-ink"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Dashboard
        </Link>
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">Moodboard</h1>
        <div role="group" aria-label="Papan" className="flex gap-1 rounded-xl bg-ground p-1">
          {MOOD_BOARDS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={active === x.id}
              onClick={() => setActive(x.id)}
              className={cx(
                "flex h-10 items-center rounded-[10px] px-3 text-[13px] font-bold transition-colors duration-150",
                active === x.id ? "bg-ink text-white" : "text-ink hover:bg-surface",
              )}
            >
              {x.name}
            </button>
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-ground p-3">
        <ViewOnly what="moodboard" />
        <MoodboardViewer key={active} data={boards[active]} fileBase="/api/files/" />
      </div>
    </div>
  );
}
