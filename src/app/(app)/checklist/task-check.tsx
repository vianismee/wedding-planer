"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTask } from "@/actions/checklist";
import { cx } from "@/components/kit";
import { useConfirm } from "@/components/confirm";

export function TaskCheck({ id, done, title }: { id: string; done: boolean; title: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  const dialogs = useConfirm();
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
