import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can } from "@/lib/roles";
import {
  addDays,
  dateLong,
  dateShort,
  dayMonth,
  dayName,
  number,
  relativeDays,
  time,
  todayISO,
} from "@/lib/format";
import { templateName, type AdatTemplateId } from "@/lib/templates";
import { TemplateDialog } from "./template-dialog";
import { EVENT_KINDS, EVENT_STATUS } from "@/lib/event-style";
import {
  addEvent,
  addRundown,
  deleteEvent,
  deleteRundown,
  moveEvent,
  setEventShare,
  updateEvent,
  updateRundown,
} from "@/actions/acara";
import { TaskCheck } from "../checklist/task-check";
import { ActionButton, ActionForm, FormDialog } from "@/components/forms";
import {
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Status,
  cx,
} from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { CopyLink } from "@/components/copy-link";
import type { Event, RundownItem } from "@/db/schema";

export const metadata: Metadata = { title: "Rangkaian acara" };

export default async function AcaraPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const ctx = await requirePage("acara");
  const edit = can(ctx.member.role, "acara.edit");
  const { e: selectedId } = await searchParams;
  const today = todayISO();

  const events = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.weddingId, ctx.wedding.id))
    .orderBy(asc(schema.event.sortOrder), asc(schema.event.date));
  const selected =
    events.find((e) => e.id === selectedId) ??
    events.find((e) => e.kind === "akad") ??
    events.find((e) => e.status !== "selesai") ??
    events[0];
  const rundown = selected
    ? await db
        .select()
        .from(schema.rundownItem)
        .where(
          and(
            eq(schema.rundownItem.eventId, selected.id),
            eq(schema.rundownItem.weddingId, ctx.wedding.id),
          ),
        )
        .orderBy(asc(schema.rundownItem.sortOrder))
    : [];

  const myTasks =
    ctx.member.role === "panitia"
      ? await db
          .select()
          .from(schema.task)
          .where(
            and(
              eq(schema.task.weddingId, ctx.wedding.id),
              eq(schema.task.assigneeMemberId, ctx.member.id),
            ),
          )
      : [];

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const allRundown = edit
    ? await db
        .select({ eventId: schema.rundownItem.eventId })
        .from(schema.rundownItem)
        .where(eq(schema.rundownItem.weddingId, ctx.wedding.id))
    : [];
  const rundownCount = new Map<string, number>();
  for (const r of allRundown)
    rundownCount.set(r.eventId, (rundownCount.get(r.eventId) ?? 0) + 1);
  const defaultAdat = (
    ["jawa", "sunda", "nasional"].includes(ctx.wedding.akadTemplate)
      ? ctx.wedding.akadTemplate
      : "nasional"
  ) as AdatTemplateId;
  const sameTpl = ctx.wedding.akadTemplate === ctx.wedding.resepsiTemplate;

  return (
    <>
      <PageHeader
        title="Rangkaian acara"
        description={
          ctx.wedding.akadTemplate === "kosong"
            ? `${events.length} acara. Dibuat tanpa template adat.`
            : sameTpl
              ? `${events.length} acara. Adat ${templateName(ctx.wedding.akadTemplate)}.`
              : `${events.length} acara. Adat ${templateName(ctx.wedding.akadTemplate)} untuk akad, ${templateName(ctx.wedding.resepsiTemplate)} untuk resepsi.`
        }
        actions={
          edit && (
            <>
              <TemplateDialog
                akadDate={ctx.wedding.akadDate}
                defaultAdat={defaultAdat}
                selectedEventId={selected?.id}
                events={events.map((e) => ({
                  id: e.id,
                  name: e.name,
                  kind: e.kind,
                  rundownCount: rundownCount.get(e.id) ?? 0,
                }))}
              />
              <FormDialog
                title="Tambah acara"
                action={addEvent}
                trigger={
                  <>
                    <Plus size={16} aria-hidden="true" />
                    Tambah acara
                  </>
                }
              >
                <EventFields />
              </FormDialog>
            </>
          )
        }
      />

      {ctx.member.role === "panitia" && (
        <Card className="flex flex-col gap-3">
          <SectionTitle>Tugas saya</SectionTitle>
          {myTasks.length === 0 ? (
            <p className="text-[13px] text-muted">
              Belum ada tugas untukmu. Tugas dari pasangan akan muncul di sini.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {myTasks.map((t) => {
                const due = addDays(ctx.wedding.akadDate, t.offsetDays);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl bg-sunken px-3 py-2"
                  >
                    <TaskCheck id={t.id} done={t.done} title={t.title} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          "block text-[14px] font-semibold",
                          t.done && "text-muted line-through",
                        )}
                      >
                        {t.title}
                      </span>
                      <span className="block text-[12px] text-muted">
                        Tenggat {dateShort(due)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Daftar acara" className="flex flex-col gap-3">
          {events.length === 0 && (
            <Empty title="Belum ada acara.">
              Tambahkan acara pertama, misalnya akad nikah, lengkap dengan jam
              dan lokasinya.
            </Empty>
          )}
          {events.map((e, i) => {
            const st = EVENT_STATUS[e.status] ?? EVENT_STATUS.persiapan;
            const dm = e.date ? dayMonth(e.date) : null;
            const isSel = selected?.id === e.id;
            const upcoming =
              e.date && e.status !== "selesai" && e.date >= today;
            return (
              <div
                key={e.id}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-3.5"
              >
                <div className="flex flex-col items-center pt-4 text-center">
                  {dm ? (
                    <>
                      <span className="text-[24px] font-extrabold leading-none tracking-[-0.02em]">
                        {dm.day}
                      </span>
                      <span className="text-[11px] font-semibold text-muted">
                        {dm.month} {String(dm.year).slice(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-muted">
                      Belum ada tanggal
                    </span>
                  )}
                </div>
                <article
                  className={cx(
                    "flex flex-col gap-3 rounded-[22px] border-2 bg-surface p-4 sm:p-[18px]",
                    isSel ? "border-ink" : "border-transparent",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-[17px] font-bold leading-snug">
                      <Link
                        href={`/acara?e=${e.id}`}
                        aria-current={isSel ? "true" : undefined}
                        className="no-underline hover:underline"
                      >
                        {e.name}
                      </Link>
                    </h2>
                    <Status
                      tone={upcoming && e.kind === "akad" ? "info" : st.tone}
                    >
                      {upcoming && e.kind === "akad"
                        ? relativeDays(e.date!, today)
                        : st.name}
                    </Status>
                  </div>
                  <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                    <div>
                      <dt className="text-[11px] font-semibold text-muted">
                        Waktu
                      </dt>
                      <dd className="font-semibold">
                        {e.date ? dayName(e.date) : "Tanggal belum diisi"}
                        {e.startTime ? `, ${time(e.startTime)} WIB` : ""}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-muted">
                        Lokasi
                      </dt>
                      <dd className="font-semibold">
                        {e.location || "Belum diisi"}
                      </dd>
                    </div>
                    {e.estimatedGuests != null && (
                      <div>
                        <dt className="text-[11px] font-semibold text-muted">
                          Perkiraan tamu
                        </dt>
                        <dd className="font-semibold">
                          {number(e.estimatedGuests)} orang
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="-mb-2 -ml-2 flex flex-wrap items-center gap-1">
                    <Link
                      href={`/acara?e=${e.id}`}
                      className="inline-flex h-11 items-center rounded-xl px-2 text-[13px] font-semibold underline-offset-2 hover:underline"
                    >
                      {isSel ? "Rundown ditampilkan" : "Lihat rundown"}
                    </Link>
                    {edit && (
                      <span className="ml-auto flex items-center">
                        <ActionButton
                          variant="icon"
                          label={`Naikkan ${e.name}`}
                          action={moveEvent.bind(null, e.id, -1)}
                          className={i === 0 ? "invisible" : ""}
                        >
                          <ArrowUp size={16} aria-hidden="true" />
                        </ActionButton>
                        <ActionButton
                          variant="icon"
                          label={`Turunkan ${e.name}`}
                          action={moveEvent.bind(null, e.id, 1)}
                          className={i === events.length - 1 ? "invisible" : ""}
                        >
                          <ArrowDown size={16} aria-hidden="true" />
                        </ActionButton>
                        <FormDialog
                          variant="icon"
                          triggerLabel={`Ubah ${e.name}`}
                          title={`Ubah ${e.name}`}
                          action={updateEvent.bind(null, e.id)}
                          trigger={<Pencil size={16} aria-hidden="true" />}
                        >
                          <EventFields e={e} />
                        </FormDialog>
                        <ActionButton
                          variant="icon"
                          label={`Hapus ${e.name}`}
                          confirm={`Hapus acara ${e.name} beserta rundown-nya?`}
                          action={deleteEvent.bind(null, e.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </ActionButton>
                      </span>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </section>

        {selected && (
          <Card
            className="flex flex-col gap-4 min-[1200px]:sticky min-[1200px]:top-4"
            aria-label={`Rundown ${selected.name}`}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-bold">
                Rundown {selected.name.toLowerCase()}
              </h2>
              <p className="text-[13px] text-muted">
                {dateLong(selected.date)}
              </p>
            </div>
            <Rundown items={rundown} edit={edit} />
            {edit && (
              <ActionForm
                action={addRundown.bind(null, selected.id)}
                resetOnSuccess
                submitLabel="Tambah sesi"
                submitVariant="ground"
              >
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                  <Field label="Jam">
                    <Input type="time" name="time" required />
                  </Field>
                  <Field label="Kegiatan">
                    <Input
                      name="activity"
                      required
                      placeholder="Contoh: Ijab kabul"
                    />
                  </Field>
                </div>
                <Field label="PIC">
                  <Input name="pic" placeholder="Contoh: MC, among tamu" />
                </Field>
              </ActionForm>
            )}
            {edit && (
              <div className="flex flex-col gap-2 border-t border-ground pt-4">
                <h3 className="text-[14px] font-bold">Bagikan ke panitia</h3>
                {selected.shareToken ? (
                  <>
                    <p className="text-[12px] text-muted">
                      Siapa pun yang punya link ini bisa melihat rundown tanpa
                      login, tanpa bisa mengubah.
                    </p>
                    <CopyLink url={`${base}/r/${selected.shareToken}`} />
                    <ActionButton
                      variant="outline"
                      size="sm"
                      action={setEventShare.bind(null, selected.id, false)}
                      className="self-start"
                    >
                      Cabut link
                    </ActionButton>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] text-muted">
                      Buat link baca-saja untuk among tamu, sinoman, dan
                      penerima tamu.
                    </p>
                    <ActionButton
                      variant="primary"
                      action={setEventShare.bind(null, selected.id, true)}
                      className="self-start"
                    >
                      Buat link rundown
                    </ActionButton>
                  </>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Rundown({ items, edit }: { items: RundownItem[]; edit: boolean }) {
  if (items.length === 0)
    return (
      <p className="rounded-[14px] bg-sunken p-4 text-[13px] text-muted">
        Rundown masih kosong. Tambahkan sesi pertama di bawah.
      </p>
    );
  return (
    <ol className="flex flex-col">
      {items.map((r) => (
        <li
          key={r.id}
          className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-3 border-b border-ground py-2.5 last:border-0"
        >
          <span className="pt-0.5 text-[13px] font-extrabold tabular">
            {time(r.time)}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">
              {r.activity}
            </span>
            {r.pic && (
              <span className="block text-[12px] text-muted">PIC {r.pic}</span>
            )}
          </span>
          {edit ? (
            <span className="-my-2 flex">
              <FormDialog
                variant="icon"
                triggerLabel={`Ubah sesi ${r.activity}`}
                title="Ubah sesi rundown"
                action={updateRundown.bind(null, r.id)}
                trigger={<Pencil size={15} aria-hidden="true" />}
              >
                <Field label="Jam">
                  <Input
                    type="time"
                    name="time"
                    required
                    defaultValue={r.time}
                  />
                </Field>
                <Field label="Kegiatan">
                  <Input name="activity" required defaultValue={r.activity} />
                </Field>
                <Field label="PIC">
                  <Input name="pic" defaultValue={r.pic ?? ""} />
                </Field>
              </FormDialog>
              <ActionButton
                variant="icon"
                label={`Hapus sesi ${r.activity}`}
                action={deleteRundown.bind(null, r.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </ActionButton>
            </span>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  );
}

function EventFields({ e }: { e?: Event }) {
  return (
    <>
      <Field label="Nama acara">
        <Input
          name="name"
          required
          defaultValue={e?.name}
          placeholder="Contoh: Siraman"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Jenis">
          <SelectField
            name="kind"
            defaultValue={e?.kind ?? "lainnya"}
            options={[
              ...EVENT_KINDS.map((k) => ({ value: k.id, label: k.name })),
            ]}
          />
        </Field>
        <Field label="Status">
          <SelectField
            name="status"
            defaultValue={e?.status ?? "persiapan"}
            options={[
              ...Object.entries(EVENT_STATUS).map(([id, s]) => ({
                value: id,
                label: s.name,
              })),
            ]}
          />
        </Field>
        <Field label="Tanggal">
          <DateField name="date" defaultValue={e?.date ?? ""} />
        </Field>
        <Field label="Jam mulai">
          <Input
            type="time"
            name="startTime"
            defaultValue={e?.startTime ?? ""}
          />
        </Field>
      </div>
      <Field label="Lokasi">
        <Input
          name="location"
          defaultValue={e?.location ?? ""}
          placeholder="Contoh: Rumah mempelai wanita"
        />
      </Field>
      <Field label="Perkiraan tamu (orang)">
        <Input
          type="number"
          min={0}
          name="estimatedGuests"
          defaultValue={e?.estimatedGuests ?? ""}
        />
      </Field>
    </>
  );
}
