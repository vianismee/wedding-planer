"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTask } from "@/actions/checklist";
import { cx } from "@/components/kit";
import { useConfirm } from "@/components/confirm";

/** Centang tugas. `readOnly`: hanya menampilkan status, untuk tugas orang lain tanpa akses ubah. */
export function TaskCheck({ id, done, title, readOnly }: { id: string; done: boolean; title: string; readOnly?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  const dialogs = useConfirm();
  if (readOnly)
    return (
      <span role="checkbox" aria-checked={done} aria-disabled="true" aria-label={title} className="inline-flex size-11 shrink-0 items-center justify-center">
        <span className={cx("flex size-[22px] items-center justify-center rounded-md border-2", done ? "border-[#8d8c9e] bg-[#8d8c9e] text-white" : "border-line bg-surface")}>
          {done && <Check size={14} strokeWidth={3} aria-hidden="true" />}
        </span>
      </span>
    );
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={title}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const r = await toggleTask(id, !optimistic);
          if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
        })
      }
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-ground"
    >
      <span
        className={cx(
          "flex size-[22px] items-center justify-center rounded-md border-2 transition-colors duration-150",
          optimistic ? "border-ink bg-ink text-white" : "border-outline bg-surface",
        )}
      >
        {optimistic && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      </span>
    </button>
  );
}
