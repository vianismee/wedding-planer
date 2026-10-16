"use client";

import Link from "next/link";
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
} from "react";
import type { DayButton } from "react-day-picker";
import {
  CalendarDays,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ActionButton, FormDialog } from "@/components/forms";
import { DateTimeField } from "@/components/date-time-field";
import { SelectField } from "@/components/select-field";
import { Field, Input, Textarea, cx } from "@/components/kit";
import { addSchedule, deleteSchedule, updateSchedule } from "@/actions/jadwal";
import { SCHEDULE_KINDS, scheduleKind } from "@/lib/schedule-kinds";
import { eventIcon } from "@/lib/event-style";
import { dateLong, time, todayISO } from "@/lib/format";

export type ScheduleData = {
  id: string;
  title: string;
  kind: string;
  date: string;
  startTime: string | null;
  location: string | null;
  vendorId: string | null;
  note: string | null;
};

export type CalItem = {
  key: string;
  date: string;
  title: string;
  type: "akad" | "acara" | "bayar" | "jadwal";
  kind?: string; // jenis acara atau jenis jadwal
  time?: string | null;
  meta?: string;
  href?: string;
  schedule?: ScheduleData;
};

const TYPE_DOT: Record<CalItem["type"], string> = {
  akad: "bg-ink",
  acara: "bg-ink",
  bayar: "bg-warn-fg",
  jadwal: "bg-info-fg",
};
const TYPE_CHIP: Record<CalItem["type"], string> = {
  akad: "bg-ok-bg text-ok-fg",
  acara: "bg-ground text-ink",
  bayar: "bg-warn-bg text-warn-fg",
  jadwal: "bg-info-bg text-info-fg",
};

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

type DayCtxValue = { byDate: Map<string, CalItem[]>; akadDate: string };
const DayCtx = createContext<DayCtxValue>({ byDate: new Map(), akadDate: "" });

// Titik penanda di bawah angka tanggal, satu per jenis yang ada di hari itu.
function MarkedDay({
  day,
  modifiers,
  className,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const { byDate, akadDate } = useContext(DayCtx);
  const iso = toISO(day.date);
  const list = byDate.get(iso) ?? [];
  const types = [...new Set(list.map((i) => i.type))];
  const isAkad = iso === akadDate;
  const isSel = modifiers.selected;
  return (
    <button
      type="button"
      {...props}
      aria-label={`${dateLong(iso)}${list.length ? `, ${list.length} jadwal` : ""}`}
      className={cx(
        "relative mx-auto flex size-10 flex-col items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-150",
        isSel
          ? "bg-ink text-white"
          : isAkad
            ? "bg-accent font-extrabold text-ink"
            : "hover:bg-ground",
        !isSel && !isAkad && modifiers.today && "bg-ground font-extrabold",
        modifiers.outside && !isSel && "text-[#a9a8b8]",
        className,
      )}
    >
      {day.date.getDate()}
      {types.length > 0 && (
        <span className="absolute bottom-1 flex gap-[3px]" aria-hidden="true">
          {types.slice(0, 3).map((t) => (
            <span
              key={t}
              className={cx(
                "size-[5px] rounded-full",
                isSel ? "bg-white" : TYPE_DOT[t],
              )}
            />
          ))}
        </span>
      )}
    </button>
  );
}

export function ScheduleCalendar({
  akadDate,
  items,
  vendors,
  canEdit,
}: {
  akadDate: string;
  items: CalItem[];
  vendors: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(fromISO(today));

  const byDate = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    for (const list of m.values())
      list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return m;
  }, [items]);

  const dayItems = byDate.get(selected) ?? [];

  return (
    <DayCtx value={{ byDate, akadDate }}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold">Kalender</h2>
          <span className="flex items-center">
            <Link
              href="/jadwal"
              className="inline-flex h-9 items-center rounded-lg px-2 text-[12px] font-semibold underline-offset-2 hover:underline"
            >
              Semua jadwal
            </Link>
            <button
              type="button"
              onClick={() => {
                setSelected(akadDate);
                setMonth(fromISO(akadDate));
              }}
              className="inline-flex h-9 items-center rounded-lg px-2 text-[12px] font-semibold underline-offset-2 hover:underline"
            >
              Ke akad
            </button>
          </span>
        </div>

        <Calendar
          mode="single"
          required
          selected={fromISO(selected)}
          onSelect={(d) => d && setSelected(toISO(d))}
          month={month}
          onMonthChange={setMonth}
          className="mx-auto w-full"
          classNames={{ root: "w-full" }}
          components={{ DayButton: MarkedDay }}
        />

        <ul
          className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-muted"
          aria-label="Keterangan warna"
        >
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full bg-accent ring-1 ring-ink/30"
              aria-hidden="true"
            />
            Akad
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-[6px] rounded-full bg-ink"
              aria-hidden="true"
            />
            Acara
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-[6px] rounded-full bg-info-fg"
              aria-hidden="true"
            />
            Jadwal
          </li>
          {items.some((i) => i.type === "bayar") && (
            <li className="flex items-center gap-1.5">
              <span
                className="size-[6px] rounded-full bg-warn-fg"
                aria-hidden="true"
              />
              Pembayaran
            </li>
          )}
        </ul>

        <div className="flex flex-col gap-2 border-t border-ground pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold" aria-live="polite">
              {selected === today ? "Hari ini" : dateLong(selected)}
            </h3>
            {canEdit && (
              <FormDialog
                key={selected}
                variant="ground"
                size="sm"
                title="Tambah jadwal"
                description="Misalnya test food, fitting busana, survey gedung, atau meeting vendor."
                action={addSchedule}
                trigger={
                  <>
                    <Plus size={14} aria-hidden="true" />
                    Jadwal
                  </>
                }
              >
                <ScheduleFields date={selected} vendors={vendors} />
              </FormDialog>
            )}
          </div>
          {dayItems.length === 0 ? (
            <p className="text-[13px] text-muted">
              Tidak ada jadwal di tanggal ini.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {dayItems.map((it) => (
                <DayItem
                  key={it.key}
                  it={it}
                  vendors={vendors}
                  canEdit={canEdit}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DayCtx>
  );
}

function DayItem({
  it,
  vendors,
  canEdit,
}: {
  it: CalItem;
  vendors: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const Icon =
    it.type === "bayar"
      ? Wallet
      : it.type === "jadwal"
        ? scheduleKind(it.kind ?? "").icon
        : it.kind
          ? eventIcon(it.kind)
          : CalendarDays;
  const body = (
    <>
      <span
        className={cx(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          TYPE_CHIP[it.type],
        )}
      >
        {createElement(Icon, { size: 16, "aria-hidden": true })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{it.title}</span>
        <span className="block truncate text-[12px] text-muted">
          {[it.time ? `${time(it.time)} WIB` : null, it.meta]
            .filter(Boolean)
            .join(", ") || "Sepanjang hari"}
        </span>
      </span>
    </>
  );

  if (it.type === "jadwal" && it.schedule && canEdit) {
    const s = it.schedule;
    return (
      <li className="flex items-center gap-2.5 rounded-[14px] bg-sunken py-1 pl-2 pr-0.5">
        {body}
        <FormDialog
          variant="icon"
          triggerLabel={`Ubah ${s.title}`}
          title="Ubah jadwal"
          action={updateSchedule.bind(null, s.id)}
          trigger={<Pencil size={14} aria-hidden="true" />}
          footer={
            <ActionButton
              variant="danger"
              className="mr-auto"
              confirm={`Hapus jadwal ${s.title}?`}
              action={deleteSchedule.bind(null, s.id)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Hapus
            </ActionButton>
          }
        >
          <ScheduleFields s={s} date={s.date} vendors={vendors} />
        </FormDialog>
      </li>
    );
  }
  return (
    <li>
      {it.href ? (
        <Link
          href={it.href}
          className="flex items-center gap-2.5 rounded-[14px] bg-sunken py-1.5 pl-2 pr-2 no-underline hover:bg-ground"
        >
          {body}
          <ChevronRight
            size={16}
            className="shrink-0 text-muted"
            aria-hidden="true"
          />
        </Link>
      ) : (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-sunken py-1.5 pl-2 pr-2">
          {body}
        </div>
      )}
    </li>
  );
}

export function ScheduleFields({
  s,
  date,
  vendors,
}: {
  s?: ScheduleData;
  date: string;
  vendors: { id: string; name: string }[];
}) {
  return (
    <>
      <Field label="Nama jadwal">
        <Input
          name="title"
          required
          defaultValue={s?.title}
          placeholder="Contoh: Test food catering"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Jenis">
          <SelectField
            name="kind"
            defaultValue={s?.kind ?? "test_food"}
            options={SCHEDULE_KINDS.map((k) => ({
              value: k.id,
              label: k.name,
            }))}
          />
        </Field>
        <Field label="Vendor terkait">
          <SelectField
            name="vendorId"
            defaultValue={s?.vendorId ?? ""}
            options={[
              { value: "", label: "Tidak ada" },
              ...vendors.map((v) => ({ value: v.id, label: v.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="Tanggal & waktu">
        <DateTimeField defaultDate={date} defaultTime={s?.startTime ?? ""} />
      </Field>
      <Field label="Lokasi">
        <Input
          name="location"
          defaultValue={s?.location ?? ""}
          placeholder="Contoh: Kantor catering"
        />
      </Field>
      <Field label="Catatan">
        <Textarea name="note" defaultValue={s?.note ?? ""} />
      </Field>
    </>
  );
}
