"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Pemilih tanggal dari Popover + Calendar shadcn.
 * Nilai disimpan sebagai "YYYY-MM-DD" di input tersembunyi `name`.
 */
export function DateField({
  name,
  value,
  defaultValue,
  onChange,
  min,
  clearable,
  placeholder = "Pilih tanggal",
  className,
  id,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  min?: string;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              data-slot="date-trigger"
              aria-label={ariaLabel}
              className={cn(
                "flex h-11 w-full items-center gap-2.5 rounded-xl border border-transparent bg-ground px-3.5 text-left text-[14px] transition-colors duration-150 hover:border-line",
                !current && "text-[#8a899c]",
                className,
              )}
            >
              <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{current ? dateShort(current) : placeholder}</span>
            </button>
          </PopoverTrigger>
          {clearable && current && (
            <button
              type="button"
              aria-label="Kosongkan tanggal"
              onClick={() => set("")}
              className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <PopoverContent align="start" className="p-2">
          <Calendar
            mode="single"
            selected={current ? fromISO(current) : undefined}
            defaultMonth={current ? fromISO(current) : min ? fromISO(min) : undefined}
            disabled={min ? { before: fromISO(min) } : undefined}
            onSelect={(d) => {
              if (d) set(toISO(d));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
