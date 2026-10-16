"use client";

import { useOptimistic, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfirm } from "./confirm";
import type { ActionResult } from "./forms";

export type StatusOption = { value: string; label: string; tone?: "ok" | "info" | "warn" | "neutral" };

const TONE = {
  ok: "bg-ok-bg text-ok-fg hover:border-transparent",
  info: "bg-info-bg text-info-fg hover:border-transparent",
  warn: "bg-warn-bg text-warn-fg hover:border-transparent",
  neutral: "bg-ground text-ink",
};

/** Label status yang bisa langsung diganti (Select shadcn), dengan pembaruan optimistis. */
export function StatusSelect({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string;
  options: StatusOption[];
  onChange: (v: string) => Promise<ActionResult>;
  label: string;
  className?: string;
}) {
  const [current, setCurrent] = useOptimistic(value);
  const [, start] = useTransition();
  const dialogs = useConfirm();
  const tone = options.find((o) => o.value === current)?.tone ?? "neutral";
  return (
    <Select
      value={current}
      onValueChange={(v) =>
        start(async () => {
          setCurrent(v);
          const r = await onChange(v);
          if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
        })
      }
    >
      <SelectTrigger
        aria-label={label}
        className={cn("h-11 w-auto gap-1.5 rounded-[10px] px-2.5 text-[12px] font-bold", TONE[tone], className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
