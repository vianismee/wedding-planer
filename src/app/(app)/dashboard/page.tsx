import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Gift,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can, type Area } from "@/lib/roles";
import {
  addDays,
  dateLong,
  dateShort,
  dateShorter,
  diffDays,
  number,
  relativeDays,
  rupiahShort,
  time,
  todayISO,
} from "@/lib/format";
import { Card, Empty, LinkButton, Meta, Progress, SectionTitle, Status, cx } from "@/components/kit";
import { ScheduleCalendar, type CalItem } from "./schedule-calendar";
import { scheduleKind } from "@/lib/schedule-kinds";
import { eventIcon, eventTone } from "@/lib/event-style";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requirePage("dashboard");
  const w = ctx.wedding;
  const wid = w.id;
  const today = todayISO();
  const seeMoney = can(ctx.perms, "budget");
  const see = (a: Area) => can(ctx.perms, a);

  const [allEvents, cats, expenses, terms, allTasks, guests, docs, items, allSchedules, vendors] = await Promise.all([
    db.select().from(schema.event).where(eq(schema.event.weddingId, wid)).orderBy(asc(schema.event.date), asc(schema.event.sortOrder)),
    db.select().from(schema.budgetCategory).where(eq(schema.budgetCategory.weddingId, wid)).orderBy(asc(schema.budgetCategory.sortOrder)),
    db.select().from(schema.expense).where(eq(schema.expense.weddingId, wid)),
    db
      .select({ term: schema.paymentTerm, vendor: schema.vendor })
      .from(schema.paymentTerm)
      .innerJoin(schema.vendor, eq(schema.paymentTerm.vendorId, schema.vendor.id))
      .where(eq(schema.paymentTerm.weddingId, wid))
      .orderBy(asc(schema.paymentTerm.dueDate)),
    db.select().from(schema.task).where(eq(schema.task.weddingId, wid)),
    db.select({ side: schema.guest.side, pax: schema.guest.pax }).from(schema.guest).where(eq(schema.guest.weddingId, wid)),
    db.select({ status: schema.document.status }).from(schema.document).where(eq(schema.document.weddingId, wid)),
    db.select({ status: schema.seserahanItem.status }).from(schema.seserahanItem).where(eq(schema.seserahanItem.weddingId, wid)),
    db.select().from(schema.schedule).where(eq(schema.schedule.weddingId, wid)).orderBy(asc(schema.schedule.date)),
    db.select({ id: schema.vendor.id, name: schema.vendor.name }).from(schema.vendor).where(eq(schema.vendor.weddingId, wid)),
  ]);
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  // Beranda hanya merangkum halaman yang boleh dilihat anggota ini. "Tugas sendiri" hanya melihat tugasnya.
  const events = see("acara") ? allEvents : [];
  const schedules = see("jadwal") ? allSchedules : [];
  const tasks = !see("checklist") ? [] : ctx.perms.checklist === "own" ? allTasks.filter((t) => t.assigneeMemberId === ctx.member.id) : allTasks;

  const daysLeft = diffDays(today, w.akadDate);
  const akad = events.find((e) => e.kind === "akad");
  const upcoming = events.filter((e) => e.status !== "selesai" && (!e.date || e.date >= today)).slice(0, 3);
  const showEvents = upcoming.length ? upcoming : events.slice(-3);

  // Budget
  const spentBy = new Map<string, number>();
  for (const e of expenses) if (e.categoryId) spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? 0) + e.amount);
  const totalBudget = cats.reduce((s, c) => s + c.allocation, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = terms.filter((t) => !t.term.paidAt);
  const nextTerm = unpaid[0];
  const highlightCat = nextTerm?.vendor.categoryId ?? null;

  // Agenda 7 hari: acara, tugas, dan pembayaran yang jatuh dalam 7 hari (termasuk yang terlewat).
  const horizon = addDays(today, 7);
  type Agenda = { key: string; title: string; date: string; meta: string; href: string; icon: LucideIcon; tone: "ok" | "info" | "warn" };
  const agenda: Agenda[] = [
    ...events
      .filter((e) => e.date && e.date >= today && e.date <= horizon)
      .map((e) => ({
        key: "e" + e.id,
        title: e.name,
        date: e.date!,
        meta: e.startTime ? `${time(e.startTime)} WIB` : "Acara",
        href: `/acara?e=${e.id}`,
        icon: CalendarDays,
        tone: "info" as const,
      })),
    ...tasks
      .filter((t) => !t.done)
      .map((t) => ({ t, due: addDays(w.akadDate, t.offsetDays) }))
      .filter(({ due }) => due <= horizon && diffDays(due, today) <= 14)
      .map(({ t, due }) => ({
        key: "t" + t.id,
        title: t.title,
        date: due,
        meta: t.pic ? `PIC ${t.pic}` : "Tugas",
        href: "/checklist",
        icon: ListChecks,
        tone: (due < today ? "warn" : "ok") as "warn" | "ok",
      })),
    ...schedules
      .filter((s) => s.date >= today && s.date <= horizon)
      .map((s) => ({
        key: "s" + s.id,
        title: s.title,
        date: s.date,
        meta: [s.startTime ? `${time(s.startTime)} WIB` : null, s.vendorId ? vendorName.get(s.vendorId) : scheduleKind(s.kind).name]
          .filter(Boolean)
          .join(", "),
        href: "/jadwal",
        icon: scheduleKind(s.kind).icon,
        tone: "info" as const,
      })),
    ...(seeMoney
      ? unpaid
          .filter((t) => t.term.dueDate <= horizon)
          .map((t) => ({
            key: "p" + t.term.id,
            title: `${t.term.label} ${t.vendor.name}`,
            date: t.term.dueDate,
            meta: rupiahShort(t.term.amount),
            href: "/budget",
            icon: Wallet,
            tone: "warn" as const,
          }))
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Kalender: acara, jadwal kustom, dan jatuh tempo pembayaran (hanya untuk peran yang melihat budget).
  const calendarItems: CalItem[] = [
    ...events
      .filter((e) => e.date)
      .map((e) => ({
        key: "e" + e.id,
        date: e.date!,
        title: e.name,
        type: (e.kind === "akad" ? "akad" : "acara") as CalItem["type"],
        kind: e.kind,
        time: e.startTime,
        meta: e.location ?? undefined,
        href: `/acara?e=${e.id}`,
      })),
    ...schedules.map((s) => ({
      key: "s" + s.id,
      date: s.date,
      title: s.title,
      type: "jadwal" as const,
      kind: s.kind,
      time: s.startTime,
      meta: [s.vendorId ? vendorName.get(s.vendorId) : null, s.location].filter(Boolean).join(", ") || scheduleKind(s.kind).name,
      schedule: {
        id: s.id,
        title: s.title,
        kind: s.kind,
        date: s.date,
        startTime: s.startTime,
        location: s.location,
        vendorId: s.vendorId,
        note: s.note,
      },
    })),
    ...(seeMoney
      ? unpaid.map(({ term, vendor }) => ({
          key: "p" + term.id,
          date: term.dueDate,
          title: `${term.label} ${vendor.name}`,
          type: "bayar" as const,
          meta: rupiahShort(term.amount),
          href: "/budget",
        }))
      : []),
  ];

  // Progres
  const pax = guests.reduce((s, g) => s + g.pax, 0);
  const quota = w.quotaGroom + w.quotaBride;
  const progress: { title: string; href: string; icon: LucideIcon; label: string; value: string; pct: number }[] = [];
  if (see("tamu"))
    progress.push({ title: "Daftar tamu", href: "/tamu", icon: Users, label: "Terdaftar", value: `${number(pax)} dari ${number(quota)} orang`, pct: quota ? (pax / quota) * 100 : 0 });
  if (see("checklist"))
    progress.push({
      title: "Checklist",
      href: "/checklist",
      icon: ListChecks,
      label: "Selesai",
      value: `${tasks.filter((t) => t.done).length} dari ${tasks.length} tugas`,
      pct: tasks.length ? (tasks.filter((t) => t.done).length / tasks.length) * 100 : 0,
    });
  if (see("seserahan"))
    progress.push({
      title: "Seserahan",
      href: "/seserahan",
      icon: Gift,
      label: "Terbeli",
      value: `${items.filter((i) => i.status === "terbeli").length} dari ${items.length} item`,
      pct: items.length ? (items.filter((i) => i.status === "terbeli").length / items.length) * 100 : 0,
    });
  if (see("dokumen"))
    progress.push({
      title: "Dokumen nikah",
      href: "/dokumen",
      icon: FileText,
      label: "Lengkap",
      value: `${docs.filter((d) => d.status === "lengkap").length} dari ${docs.length} dokumen`,
      pct: docs.length ? (docs.filter((d) => d.status === "lengkap").length / docs.length) * 100 : 0,
    });

  const maxBar = Math.max(1, ...cats.map((c) => Math.max(c.allocation, spentBy.get(c.id) ?? 0)));
  const firstName = ctx.user.name.split(" ")[0] || ctx.user.name;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">
          Halo, {firstName}
        </h1>
        <p className="text-[14px] text-muted">
          {dateLong(today)}. Persiapan pernikahan {w.groomName} dan {w.brideName}.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Rangkaian acara */}
          {see("acara") && (
            <section className="flex flex-col gap-3" aria-labelledby="acara-title">
              <SectionTitle
                id="acara-title"
                aside={
                  <Link href="/acara" className="text-[13px] font-semibold underline-offset-2 hover:underline">
                    Lihat semua acara
                  </Link>
                }
              >
                Rangkaian acara
              </SectionTitle>
              {showEvents.length === 0 ? (
                <Empty title="Belum ada acara." action={can(ctx.perms, "acara", "edit") && <LinkButton href="/acara">Tambah acara</LinkButton>}>
                  {can(ctx.perms, "acara", "edit") ? "Tambahkan acara pertama supaya keluarga tahu jadwalnya." : "Acara akan muncul di sini setelah ditambahkan."}
                </Empty>
              ) : (
                <div className="-mx-1 grid snap-x snap-mandatory auto-cols-[80%] grid-flow-col gap-4 overflow-x-auto px-1 pb-1 min-[720px]:grid-flow-row min-[720px]:grid-cols-3 min-[720px]:overflow-visible">
                  {showEvents.map((e) => {
                    const Icon = eventIcon(e.kind);
                    const tone = eventTone(e.kind);
                    return (
                      <Link
                        key={e.id}
                        href={`/acara?e=${e.id}`}
                        className="flex snap-start flex-col gap-4 rounded-[22px] bg-surface p-[18px] no-underline transition-colors duration-150 hover:bg-[#fbfbfd]"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cx("flex size-[42px] shrink-0 items-center justify-center rounded-full", tone)}>
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-bold">{e.name}</div>
                            <div className="text-[12px] text-muted">{dateShort(e.date)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                          {e.status === "selesai" ? (
                            <Meta label="Status">Selesai</Meta>
                          ) : (
                            <Meta label="Waktu">{e.startTime ? `${time(e.startTime)} WIB` : "Belum diisi"}</Meta>
                          )}
                          <Meta label="Lokasi">{e.location || "Belum diisi"}</Meta>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <div className={cx("grid grid-cols-1 gap-4", seeMoney && "min-[720px]:grid-cols-2")}>
            {seeMoney && (
              <Card className="flex flex-col gap-4" aria-labelledby="budget-title">
                <div className="flex flex-col gap-1">
                  <SectionTitle id="budget-title">Budget terpakai</SectionTitle>
                  <p className="text-[13px] text-muted">
                    <span className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{rupiahShort(totalSpent)}</span> dari{" "}
                    {rupiahShort(totalBudget)}
                    {totalBudget > 0 && (
                      <Status tone={totalSpent > totalBudget ? "warn" : "ok"} className="ml-2 align-middle">
                        {Math.round((totalSpent / totalBudget) * 100)}%
                      </Status>
                    )}
                  </p>
                </div>
                {cats.length === 0 ? (
                  <Empty title="Belum ada kategori budget." action={<LinkButton href="/budget">Atur budget</LinkButton>} />
                ) : (
                  <div
                    className="flex h-[170px] items-end gap-2"
                    role="img"
                    aria-label={`Pemakaian budget per kategori. ${cats
                      .map((c) => `${c.name} ${rupiahShort(spentBy.get(c.id) ?? 0)} dari ${rupiahShort(c.allocation)}`)
                      .join(". ")}`}
                  >
                    {cats.slice(0, 8).map((c) => {
                      const spent = spentBy.get(c.id) ?? 0;
                      const hi = c.id === highlightCat;
                      return (
                        <div key={c.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                          {hi && (
                            <span className="whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
                              {rupiahShort(spent)}
                            </span>
                          )}
                          <div className="relative w-full max-w-9 flex-1">
                            <div
                              className="absolute bottom-0 w-full rounded-[10px] bg-ground"
                              style={{ height: `${(c.allocation / maxBar) * 100}%` }}
                            />
                            <div
                              className={cx("absolute bottom-0 w-full rounded-[10px]", hi ? "bg-accent" : "bg-ink")}
                              style={{ height: `${(Math.min(spent, maxBar) / maxBar) * 100}%` }}
                            />
                          </div>
                          <span className="w-full truncate text-center text-[11px] font-semibold text-muted">{c.name.split(" ")[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {nextTerm && (
                  <p className="text-[12px] text-muted">
                    Disorot: kategori dengan pembayaran terdekat, {nextTerm.term.label} {nextTerm.vendor.name}.
                  </p>
                )}
              </Card>
            )}

            <section className="flex flex-col gap-3" aria-labelledby="agenda-title">
              <SectionTitle id="agenda-title">Agenda 7 hari</SectionTitle>
              {agenda.length === 0 ? (
                <Empty title="Tidak ada agenda 7 hari ke depan.">
                  Acara, tugas, dan pembayaran yang jatuh tempo minggu ini akan muncul di sini.
                </Empty>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {agenda.slice(0, 6).map((a) => {
                    const Icon = a.icon;
                    return (
                      <Link
                        key={a.key}
                        href={a.href}
                        className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 no-underline hover:bg-[#fbfbfd]"
                      >
                        <span
                          className={cx(
                            "flex size-[42px] shrink-0 items-center justify-center rounded-xl",
                            a.tone === "ok" ? "bg-ok-bg text-ok-fg" : a.tone === "info" ? "bg-info-bg text-info-fg" : "bg-warn-bg text-warn-fg",
                          )}
                        >
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold">{a.title}</span>
                          <span className="block text-[12px] text-muted">
                            {a.date === today ? "Hari ini" : dateShorter(a.date)}, {a.meta}
                          </span>
                        </span>
                        {a.date < today && <Status tone="warn">{relativeDays(a.date, today)}</Status>}
                        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {progress.length > 0 && (
            <Card className="flex flex-col gap-2" aria-labelledby="progres-title">
              <SectionTitle id="progres-title">Progres persiapan</SectionTitle>
              <ul className="flex flex-col">
                {progress.map((p) => {
                  const Icon = p.icon;
                  return (
                    <li key={p.title} className="border-b border-ground last:border-0">
                      <Link
                        href={p.href}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 no-underline min-[720px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(120px,1fr)]"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ground">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="truncate text-[14px] font-bold">{p.title}</span>
                        </span>
                        <span className="text-right min-[720px]:text-left">
                          <span className="block text-[11px] font-semibold text-muted">{p.label}</span>
                          <span className="block text-[13px] font-bold">{p.value}</span>
                        </span>
                        <span className="col-span-2 flex items-center gap-3 min-[720px]:col-span-1">
                          <Progress value={p.pct} className="flex-1" label={`${p.title} ${Math.round(p.pct)}%`} />
                          <span className="w-10 text-right text-[13px] font-bold tabular">{Math.round(Math.min(p.pct, 999))}%</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        {/* Kolom kanan */}
        <div className="grid grid-cols-1 min-w-0 content-start gap-5 min-[900px]:grid-cols-2 min-[1200px]:grid-cols-1">
          <Card tone="ink" className="relative flex flex-col gap-2 overflow-hidden">
            <svg width="150" height="110" viewBox="0 0 150 110" fill="none" aria-hidden="true" className="absolute -bottom-4 -right-4">
              <circle cx="55" cy="60" r="38" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="8" />
              <circle cx="100" cy="60" r="38" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="8" />
            </svg>
            <div className="text-[12px] font-semibold text-[#c9c8d6]">Hitung mundur</div>
            <div className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
              {daysLeft > 0 ? `${number(daysLeft)} hari lagi` : daysLeft === 0 ? "Hari ini" : "Sudah menikah"}
            </div>
            <div className="max-w-[200px] text-[13px] leading-[1.45] text-[#d9d8e4]">
              Akad nikah
              <br />
              {dateLong(w.akadDate)}
            </div>
            {see("acara") && (
              <Link
                href={akad ? `/acara?e=${akad.id}` : "/acara"}
                className="relative mt-2 inline-flex h-11 items-center self-start rounded-xl bg-white px-4 text-[13px] font-bold text-ink no-underline hover:bg-[#ececf3]"
              >
                Lihat rundown akad
              </Link>
            )}
          </Card>

          <Card>
            <ScheduleCalendar akadDate={w.akadDate} items={calendarItems} vendors={vendors} canEdit={can(ctx.perms, "jadwal", "edit")} />
          </Card>

          {seeMoney && (
            <section className="flex flex-col gap-3 min-[900px]:col-span-2 min-[1200px]:col-span-1" aria-labelledby="bayar-title">
              <SectionTitle
                id="bayar-title"
                aside={
                  <Link href="/vendor" className="text-[13px] font-semibold underline-offset-2 hover:underline">
                    Semua vendor
                  </Link>
                }
              >
                Pembayaran vendor
              </SectionTitle>
              {unpaid.length === 0 ? (
                <Empty title="Belum ada termin yang harus dibayar.">
                  Pilih penawaran di halaman Vendor, termin DP akan dibuat otomatis.
                </Empty>
              ) : (
                unpaid.slice(0, 3).map(({ term, vendor }) => {
                  const d = diffDays(today, term.dueDate);
                  return (
                    <div key={term.id} className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3">
                      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn-fg">
                        <Wallet size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">{vendor.name}</div>
                        <div className="text-[12px] text-muted">
                          {term.label} {rupiahShort(term.amount)}, {dateShorter(term.dueDate)}
                        </div>
                      </div>
                      <Status tone={d <= 7 ? "warn" : "neutral"}>{relativeDays(term.dueDate, today)}</Status>
                    </div>
                  );
                })
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
