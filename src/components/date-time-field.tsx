"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { dateShort, time as fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Pilihan jam 05.00 sampai 23.45, per 15 menit.
const SLOTS = Array.from({ length: (24 - 5) * 4 }, (_, i) => {
  const mins = 5 * 60 + i * 15;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

/**
 * Pemilih tanggal dan waktu dalam satu kolom, mengikuti blok kalender shadcn
 * (kalender di kiri, daftar jam di kanan). Nilai dikirim lewat dua input tersembunyi.
 */
export function DateTimeField({
  dateName = "date",
  timeName = "startTime",
  defaultDate = "",
  defaultTime = "",
  className,
  id,
}: {
  dateName?: string;
  timeName?: string;
  defaultDate?: string;
  defaultTime?: string;
  className?: string;
  id?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ? defaultTime.slice(0, 5) : "");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Gulirkan daftar jam ke jam terpilih (atau 08.00) saat dibuka.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const target = listRef.current?.querySelector<HTMLElement>(`[data-time="${time || "08:00"}"]`);
      target?.scrollIntoView({ block: "center" });
    }, 0);
    return () => clearTimeout(t);
  }, [open, time]);

  const label = date ? `${dateShort(date)}${time ? `, ${fmtTime(time)} WIB` : ", tanpa jam"}` : "Pilih tanggal dan waktu";

  return (
    <>
      <input type="hidden" name={dateName} value={date} />
      <input type="hidden" name={timeName} value={time} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            data-slot="date-trigger"
            className={cn(
              "flex h-11 w-full items-center gap-2.5 rounded-xl border border-transparent bg-ground px-3.5 text-left text-[14px] transition-colors duration-150 hover:border-line",
              !date && "text-[#8a899c]",
              className,
            )}
          >
            <CalendarClock className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-32px)] gap-0 p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="p-2">
              <Calendar
                mode="single"
                selected={date ? fromISO(date) : undefined}
                defaultMonth={date ? fromISO(date) : undefined}
                onSelect={(d) => d && setDate(toISO(d))}
              />
            </div>
            <div className="flex flex-col border-t border-line sm:w-[132px] sm:border-t-0 sm:border-l">
              <div className="px-3 pt-3 pb-1 text-[12px] font-semibold text-muted">Waktu</div>
              <div
                ref={listRef}
                role="listbox"
                aria-label="Pilih jam"
                className="flex max-h-[140px] gap-1.5 overflow-auto px-3 pb-3 sm:max-h-[300px] sm:flex-col sm:flex-nowrap max-sm:flex-wrap"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={time === ""}
                  onClick={() => setTime("")}
                  className={cn(
                    "h-10 shrink-0 rounded-[10px] px-3 text-[13px] font-semibold transition-colors duration-150",
                    time === "" ? "bg-ink text-white" : "bg-ground hover:bg-[#e8e7ef]",
                  )}
                >
                  Tanpa jam
                </button>
                {SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    data-time={s}
                    aria-selected={time === s}
                    onClick={() => setTime(s)}
                    className={cn(
                      "h-10 shrink-0 rounded-[10px] px-3 text-[13px] font-semibold tabular-nums transition-colors duration-150",
                      time === s ? "bg-ink text-white" : "bg-ground hover:bg-[#e8e7ef]",
                    )}
                  >
                    {fmtTime(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line p-3">
            <span className="text-[13px] font-semibold">{date ? label : "Pilih tanggal dulu"}</span>
            <Button size="sm" disabled={!date} onClick={() => setOpen(false)}>
              Selesai
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
