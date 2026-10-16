"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { id as localeId } from "date-fns/locale"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Kalender shadcn yang disesuaikan: bahasa Indonesia, minggu mulai Senin,
 * sel 40px, tanggal terpilih berlatar ink, hari ini berlatar ground.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()

  return (
    <DayPicker
      locale={localeId}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("group/calendar [--cell-size:--spacing(10)]", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", d.nav),
        button_previous: cn(
          "inline-flex size-(--cell-size) items-center justify-center rounded-xl text-ink transition-colors duration-150 hover:bg-ground aria-disabled:opacity-40",
          d.button_previous
        ),
        button_next: cn(
          "inline-flex size-(--cell-size) items-center justify-center rounded-xl text-ink transition-colors duration-150 hover:bg-ground aria-disabled:opacity-40",
          d.button_next
        ),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", d.month_caption),
        caption_label: cn("text-[15px] font-bold capitalize select-none", d.caption_label),
        dropdowns: cn("flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-[14px] font-bold", d.dropdowns),
        dropdown_root: cn("relative rounded-[10px]", d.dropdown_root),
        dropdown: cn("absolute inset-0 bg-surface opacity-0", d.dropdown),
        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("flex-1 pb-1 text-[12px] font-semibold text-muted capitalize select-none", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("relative aspect-square h-full w-full p-0 text-center select-none", d.day),
        today: cn("today", d.today),
        outside: cn("outside text-[#757488]", d.outside),
        disabled: cn("text-[#c9c8d6]", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...p }) => <div data-slot="calendar" ref={rootRef} className={cn(className)} {...p} />,
        Chevron: ({ className, orientation, ...p }) => {
          if (orientation === "left") return <ChevronLeftIcon className={cn("size-[18px]", className)} {...p} />
          if (orientation === "right") return <ChevronRightIcon className={cn("size-[18px]", className)} {...p} />
          return <ChevronDownIcon className={cn("size-4", className)} {...p} />
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.isoDate}
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      className={cn(
        "relative mx-auto flex size-(--cell-size) max-w-full flex-col items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-150 hover:bg-ground",
        "data-[today]:font-extrabold data-[today]:not-data-[selected]:bg-ground",
        "data-[selected]:bg-ink data-[selected]:text-white data-[selected]:hover:bg-ink",
        modifiers.outside && "text-[#757488]",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
