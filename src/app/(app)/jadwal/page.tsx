import type { Metadata } from "next";
import Link from "next/link";
import { createElement } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { MapPin, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can } from "@/lib/roles";
import { dateLong, dayMonth, relativeDays, time, todayISO } from "@/lib/format";
import { SCHEDULE_KINDS, scheduleKind } from "@/lib/schedule-kinds";
import { deleteSchedule, updateSchedule, addSchedule } from "@/actions/jadwal";
import { ActionButton, FormDialog } from "@/components/forms";
import { Empty, PageHeader, Status, ViewOnly, cx } from "@/components/kit";
import { ScheduleFields } from "../dashboard/schedule-calendar";

export const metadata: Metadata = { title: "Jadwal" };

const KIND_TONE: Record<string, string> = {
  test_food: "bg-warn-bg text-warn-fg",
  fitting: "bg-info-bg text-info-fg",
  survey: "bg-ok-bg text-ok-fg",
  meeting: "bg-ground text-ink",
  lainnya: "bg-ground text-ink",
};

export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ jenis?: string; waktu?: string }> }) {
  const ctx = await requirePage("jadwal");
  const edit = can(ctx.perms, "jadwal", "edit");
  const wid = ctx.wedding.id;
  const today = todayISO();
  const { jenis, waktu } = await searchParams;
  const past = waktu === "lewat";
  const kind = SCHEDULE_KINDS.some((k) => k.id === jenis) ? jenis : undefined;

  const [all, vendors] = await Promise.all([
    db
      .select()
      .from(schema.schedule)
      .where(eq(schema.schedule.weddingId, wid))
      .orderBy(past ? desc(schema.schedule.date) : asc(schema.schedule.date), asc(schema.schedule.startTime)),
    db.select({ id: schema.vendor.id, name: schema.vendor.name }).from(schema.vendor).where(eq(schema.vendor.weddingId, wid)),
  ]);
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  const upcomingAll = all.filter((s) => s.date >= today);
  const pastAll = all.filter((s) => s.date < today);
  const inTime = past ? pastAll : upcomingAll;
  const list = kind ? inTime.filter((s) => s.kind === kind) : inTime;

  // Kelompokkan per tanggal.
  const groups: { date: string; items: typeof list }[] = [];
  for (const s of list) {
    const g = groups.at(-1);
    if (g && g.date === s.date) g.items.push(s);
    else groups.push({ date: s.date, items: [s] });
  }

  const href = (q: { jenis?: string; waktu?: string }) => {
    const p = new URLSearchParams();
    if (q.jenis) p.set("jenis", q.jenis);
    if (q.waktu) p.set("waktu", q.waktu);
    const s = p.toString();
    return s ? `/jadwal?${s}` : "/jadwal";
  };
  const next = upcomingAll[0];

  return (
    <>
      <PageHeader
        title="Jadwal"
        description={
          next
            ? `${upcomingAll.length} jadwal akan datang. Terdekat: ${next.title}, ${relativeDays(next.date, today).toLowerCase()}.`
            : "Test food, fitting busana, survey lokasi, meeting vendor, dan janji lain di luar rangkaian acara."
        }
        actions={
          edit && (
            <FormDialog
              title="Tambah jadwal"
              description="Misalnya test food, fitting busana, survey gedung, atau meeting vendor."
              action={addSchedule}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Tambah jadwal
                </>
              }
            >
              <ScheduleFields date={today} vendors={vendors} />
            </FormDialog>
          )
        }
      />
      {!edit && <ViewOnly what="jadwal" />}

      <div className="flex flex-col gap-3">
        <nav aria-label="Waktu" className="flex gap-1 self-start rounded-xl bg-surface p-1">
          {[
            { label: "Akan datang", n: upcomingAll.length, q: undefined },
            { label: "Sudah lewat", n: pastAll.length, q: "lewat" },
          ].map((t) => {
            const on = (t.q === "lewat") === past;
            return (
              <Link
                key={t.label}
                href={href({ jenis: kind, waktu: t.q })}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-bold no-underline transition-colors duration-150",
                  on ? "bg-ink text-white" : "text-ink hover:bg-ground",
                )}
              >
                {t.label}
                <span className={cx("text-[12px] font-semibold", on ? "text-[#c9c8d6]" : "text-muted")}>{t.n}</span>
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Jenis jadwal" className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
          {[{ id: undefined, name: "Semua" }, ...SCHEDULE_KINDS].map((k) => {
            const on = kind === k.id;
            const n = k.id ? inTime.filter((s) => s.kind === k.id).length : inTime.length;
            return (
              <Link
                key={k.name}
                href={href({ jenis: k.id, waktu: past ? "lewat" : undefined })}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "hit-44 flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold no-underline transition-colors duration-150",
                  on ? "bg-ink text-white" : "text-ink hover:bg-ground",
                )}
              >
                {k.name}
                <span className={cx("text-[12px] font-semibold", on ? "text-[#c9c8d6]" : "text-muted")}>{n}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {groups.length === 0 ? (
        <Empty
          title={
            all.length === 0
              ? "Belum ada jadwal."
              : past
                ? "Belum ada jadwal yang lewat untuk filter ini."
                : "Tidak ada jadwal mendatang untuk filter ini."
          }
        >
          {all.length === 0
            ? "Tambahkan janji seperti test food catering atau fitting busana supaya keluarga tahu kapan dan di mana."
            : "Ubah filter jenis, atau lihat tab lainnya."}
        </Empty>
      ) : (
        <section aria-label="Daftar jadwal" className="flex flex-col gap-3">
          {groups.map((g) => {
            const dm = dayMonth(g.date);
            return (
              <div key={g.date} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-3.5">
                <div className="flex flex-col items-center pt-4 text-center">
                  <span className="text-[24px] font-extrabold leading-none tracking-[-0.02em]">{dm.day}</span>
                  <span className="text-[11px] font-semibold text-muted">
                    {dm.month} {String(dm.year).slice(2)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 rounded-[22px] bg-surface p-4 sm:p-[18px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-bold">{dateLong(g.date)}</h2>
                    {!past && <Status tone={g.date === today ? "warn" : "neutral"}>{relativeDays(g.date, today)}</Status>}
                  </div>
                  <ul className="flex flex-col">
                    {g.items.map((s) => {
                      const k = scheduleKind(s.kind);
                      return (
                        <li key={s.id} className="flex items-start gap-3 border-b border-ground py-2.5 last:border-0">
                          <span className={cx("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", KIND_TONE[s.kind] ?? KIND_TONE.lainnya)}>
                            {createElement(k.icon, { size: 18, "aria-hidden": true })}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold">{s.title}</p>
                            <p className="text-[12px] text-muted">
                              {k.name}, {s.startTime ? `${time(s.startTime)} WIB` : "jam belum ditentukan"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                              {s.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={13} aria-hidden="true" />
                                  {s.location}
                                </span>
                              )}
                              {s.vendorId && vendorName.get(s.vendorId) && (
                                <Link href="/vendor" className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                                  <Store size={13} aria-hidden="true" />
                                  {vendorName.get(s.vendorId)}
                                </Link>
                              )}
                            </div>
                            {s.note && <p className="mt-1.5 rounded-[10px] bg-sunken px-2.5 py-1.5 text-[12px]">{s.note}</p>}
                          </div>
                          {edit && (
                            <span className="-my-1 flex shrink-0">
                              <FormDialog
                                variant="icon"
                                triggerLabel={`Ubah ${s.title}`}
                                title="Ubah jadwal"
                                action={updateSchedule.bind(null, s.id)}
                                trigger={<Pencil size={15} aria-hidden="true" />}
                              >
                                <ScheduleFields s={s} date={s.date} vendors={vendors} />
                              </FormDialog>
                              <ActionButton
                                variant="icon"
                                label={`Hapus ${s.title}`}
                                confirm={`Hapus jadwal ${s.title}?`}
                                action={deleteSchedule.bind(null, s.id)}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </ActionButton>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
