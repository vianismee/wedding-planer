import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { addDays, dateShort, dateShorter, relativeDays, todayISO } from "@/lib/format";
import { TASK_RANGES } from "@/lib/templates";
import { roleName } from "@/lib/roles";
import { addTask, deleteTask, updateTask } from "@/actions/checklist";
import { ActionButton, FormDialog } from "@/components/forms";
import { Field, Input, PageHeader, Status, ViewOnly, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { TaskCheck } from "./task-check";
import type { Task } from "@/db/schema";

export const metadata: Metadata = { title: "Checklist" };

type MemberOpt = { id: string; name: string; role: string };

export default async function ChecklistPage({ searchParams }: { searchParams: Promise<{ pic?: string }> }) {
  const ctx = await requirePage("checklist");
  const w = ctx.wedding;
  const today = todayISO();
  const { pic } = await searchParams;
  // "Tugas sendiri": hanya tugas yang ditugaskan ke anggota ini, seperti peran Panitia.
  const isPanitia = ctx.perms.checklist === "own";
  const edit = ctx.perms.checklist === "edit";

  const [all, members] = await Promise.all([
    db
      .select()
      .from(schema.task)
      .where(
        isPanitia
          ? and(eq(schema.task.weddingId, w.id), eq(schema.task.assigneeMemberId, ctx.member.id))
          : eq(schema.task.weddingId, w.id),
      )
      .orderBy(asc(schema.task.offsetDays), asc(schema.task.createdAt)),
    db
      .select({ id: schema.member.id, name: schema.user.name, email: schema.user.email, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.member.weddingId, w.id)),
  ]);
  const memberOpts: MemberOpt[] = members.map((m) => ({ id: m.id, name: m.name || m.email, role: roleName(m.role, ctx.roles) }));
  const memberName = new Map(memberOpts.map((m) => [m.id, m.name]));

  const pics = [...new Set(all.map((t) => t.pic).filter((x): x is string => Boolean(x)))].sort();
  const tasks = pic ? all.filter((t) => t.pic === pic) : all;
  const doneCount = all.filter((t) => t.done).length;

  const columns = TASK_RANGES.map((r) => ({
    ...r,
    items: tasks.filter((t) => t.offsetDays >= r.min && t.offsetDays <= r.max),
  })).filter((c) => c.items.length > 0 || !pic);

  return (
    <>
      <PageHeader
        title={isPanitia ? "Tugas saya" : "Checklist"}
        description={`${doneCount} dari ${all.length} tugas selesai. Tenggat disusun mundur dari akad ${dateShort(w.akadDate)} dan ikut bergeser bila tanggal akad diubah.`}
        actions={
          edit && (
            <FormDialog
              title="Tambah tugas"
              action={addTask}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Tambah tugas
                </>
              }
            >
              <TaskFields members={memberOpts} defaultDue={addDays(today, 7)} />
            </FormDialog>
          )
        }
      />

      {ctx.perms.checklist === "view" && <ViewOnly what="checklist" />}

      {pics.length > 1 && (
        <nav aria-label="Filter PIC" className="flex flex-wrap gap-1 self-start rounded-xl bg-surface p-1">
          {[undefined, ...pics].map((p) => {
            const on = pic === p;
            return (
              <Link
                key={p ?? "semua"}
                href={p ? `/checklist?pic=${encodeURIComponent(p)}` : "/checklist"}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "hit-44 flex h-9 items-center rounded-[10px] px-3 text-[13px] font-bold no-underline transition-colors duration-150",
                  on ? "bg-ink text-white" : "text-ink hover:bg-ground",
                )}
              >
                {p ?? "Semua PIC"}
              </Link>
            );
          })}
        </nav>
      )}

      {all.length === 0 ? (
        <div className="rounded-[22px] bg-surface p-5">
          <p className="text-[14px] font-bold">{isPanitia ? "Belum ada tugas untukmu." : "Checklist masih kosong."}</p>
          <p className="text-[13px] text-muted">
            {isPanitia ? "Tugas yang diberikan pasangan akan muncul di sini." : edit ? "Tambahkan tugas pertama beserta PIC dan tenggatnya." : "Tugas akan muncul di sini setelah ditambahkan."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 min-[720px]:grid-cols-2 min-[1200px]:grid-cols-3">
          {columns.map((col) => {
            const done = col.items.filter((t) => t.done).length;
            return (
              <section key={col.id} className="flex flex-col gap-2 rounded-[22px] bg-surface p-4" aria-labelledby={`col-${col.id}`}>
                <div className="flex items-start justify-between gap-2 pb-1">
                  <div>
                    <h2 id={`col-${col.id}`} className="text-[16px] font-bold">
                      {col.title}
                    </h2>
                    <p className="text-[12px] text-muted">sebelum akad</p>
                  </div>
                  <Status tone={col.items.length && done === col.items.length ? "ok" : "neutral"}>
                    {done} dari {col.items.length}
                  </Status>
                </div>
                {col.items.length === 0 && <p className="text-[13px] text-muted">Tidak ada tugas di rentang ini.</p>}
                {col.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    t={t}
                    akad={w.akadDate}
                    today={today}
                    members={memberOpts}
                    memberName={memberName}
                    canEdit={edit}
                    // Tanpa akses ubah, tugas yang ditugaskan ke diri sendiri tetap bisa dicentang.
                    canTick={edit || t.assigneeMemberId === ctx.member.id}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function TaskRow({
  t,
  akad,
  today,
  members,
  memberName,
  canEdit,
  canTick,
}: {
  t: Task;
  akad: string;
  today: string;
  members: MemberOpt[];
  memberName: Map<string, string>;
  canEdit: boolean;
  canTick: boolean;
}) {
  const due = addDays(akad, t.offsetDays);
  const overdue = !t.done && due < today;
  const who = [t.pic, t.assigneeMemberId ? memberName.get(t.assigneeMemberId) : null].filter(Boolean).join(", ");
  return (
    <div className="flex items-start gap-1 rounded-[14px] bg-sunken py-1 pl-1 pr-1">
      <TaskCheck id={t.id} done={t.done} title={t.title} readOnly={!canTick} />
      <div className="min-w-0 flex-1 py-2">
        <p className={cx("text-[14px] font-semibold leading-snug", t.done && "text-muted line-through")}>{t.title}</p>
        <p className="text-[12px] text-muted">
          {who ? `PIC ${who}, ` : ""}tenggat {dateShorter(due)}
        </p>
        {overdue && <Status tone="warn" className="mt-1">{relativeDays(due, today)}</Status>}
      </div>
      {canEdit && (
        <FormDialog
          variant="icon"
          triggerLabel={`Ubah ${t.title}`}
          title="Ubah tugas"
          action={updateTask.bind(null, t.id)}
          trigger={<Pencil size={14} aria-hidden="true" />}
          footer={
            <ActionButton variant="danger" className="mr-auto" confirm={`Hapus tugas ${t.title}?`} action={deleteTask.bind(null, t.id)}>
              <Trash2 size={14} aria-hidden="true" />
              Hapus
            </ActionButton>
          }
        >
          <TaskFields t={t} members={members} defaultDue={due} />
        </FormDialog>
      )}
    </div>
  );
}

function TaskFields({ t, members, defaultDue }: { t?: Task; members: MemberOpt[]; defaultDue: string }) {
  return (
    <>
      <Field label="Tugas">
        <Input name="title" required defaultValue={t?.title} placeholder="Contoh: Survey dekorasi pelaminan" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="PIC" hint="Nama atau peran, misalnya Keluarga wanita.">
          <Input name="pic" defaultValue={t?.pic ?? ""} />
        </Field>
        <Field label="Tenggat">
          <DateField name="dueDate" defaultValue={defaultDue} />
        </Field>
      </div>
      <Field label="Tugaskan ke anggota" hint="Anggota dengan akses Tugas sendiri hanya melihat tugas yang ditugaskan kepadanya.">
        <SelectField name="assigneeMemberId" defaultValue={t?.assigneeMemberId ?? ""} options={[{ value: "", label: "Tidak ditugaskan" }, ...members.map((m) => ({ value: m.id, label: <>{m.name} ({m.role})</> }))]} />
      </Field>
    </>
  );
}
