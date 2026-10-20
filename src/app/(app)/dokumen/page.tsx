import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can } from "@/lib/roles";
import { DOC_STEPS, officeFor } from "@/lib/templates";
import { dateShort } from "@/lib/format";
import { addDocument, deleteDocument, deleteDocumentFile, updateDocument } from "@/actions/dokumen";
import { ActionButton, FormDialog } from "@/components/forms";
import { FileInput } from "@/components/file-input";
import { Avatar, Field, Input, Note, PageHeader, Status, cx, ViewOnly } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import type { Document } from "@/db/schema";
import { DocStatus } from "./doc-status";

export const metadata: Metadata = { title: "Dokumen nikah" };

export default async function DokumenPage() {
  const ctx = await requirePage("dokumen");
  const edit = can(ctx.perms, "dokumen", "edit");
  const w = ctx.wedding;
  const office = officeFor(w.religion) as "KUA" | "Dukcapil";
  const [docs, files] = await Promise.all([
    db.select().from(schema.document).where(eq(schema.document.weddingId, w.id)).orderBy(asc(schema.document.sortOrder)),
    db.select({ id: schema.file.id, name: schema.file.name }).from(schema.file).where(eq(schema.file.weddingId, w.id)),
  ]);
  const fileName = new Map(files.map((f) => [f.id, f.name]));
  const people = [
    { id: "pria", name: w.groomName, role: "Calon suami", tone: "info" as const },
    { id: "wanita", name: w.brideName, role: "Calon istri", tone: "ok" as const },
  ];

  // Tahap dianggap selesai bila semua dokumen dasar sudah lengkap.
  const basicDone = docs.filter((d) => ["KTP", "Kartu Keluarga", "Akta kelahiran"].includes(d.name)).every((d) => d.status === "lengkap");
  const steps = DOC_STEPS[office].map((s, i) => ({
    ...s,
    note: s.note || (i === DOC_STEPS[office].length - 1 ? dateShort(w.akadDate) : ""),
    done: i === 0 && basicDone,
  }));

  return (
    <>
      <PageHeader
        title="Dokumen nikah"
        description={`Jalur ${office}${w.officeName ? `, ${w.officeName}` : ""}. Scan hanya bisa dilihat anggota yang punya akses Dokumen nikah.`}
        actions={
          edit && (
            <FormDialog
              title="Tambah dokumen"
              action={addDocument}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Tambah dokumen
                </>
              }
            >
              <Field label="Nama dokumen">
                <Input name="name" required placeholder="Contoh: Surat izin orang tua" />
              </Field>
              <Field label="Milik">
                <SelectField name="person" defaultValue="pria" options={[{ value: "pria", label: <>{w.groomName} (calon suami)</> }, { value: "wanita", label: <>{w.brideName} (calon istri)</> }]} />
              </Field>
            </FormDialog>
          )
        }
      />
      {!edit && <ViewOnly what="dokumen nikah" />}

      <ol aria-label="Tahapan" className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1100px]:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-[18px] bg-surface p-3.5">
            <span
              className={cx(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
                s.done ? "bg-ok-bg text-ok-fg" : "bg-ground",
              )}
              aria-label={s.done ? "Selesai" : `Tahap ${i + 1}`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-snug">{s.title}</span>
              {s.note && <span className="block text-[12px] text-muted">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-2">
        {people.map((p) => {
          const list = docs.filter((d) => d.person === p.id);
          const done = list.filter((d) => d.status === "lengkap").length;
          return (
            <section key={p.id} className="flex flex-col gap-1 rounded-[22px] bg-surface p-4 sm:p-5" aria-labelledby={`doc-${p.id}`}>
              <div className="flex items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} tone={p.tone} size={40} />
                  <div>
                    <h2 id={`doc-${p.id}`} className="text-[17px] font-bold">
                      {p.name}
                    </h2>
                    <p className="text-[12px] text-muted">{p.role}</p>
                  </div>
                </div>
                <Status tone={done === list.length && list.length > 0 ? "ok" : "neutral"}>
                  {done} dari {list.length} lengkap
                </Status>
              </div>
              {list.length === 0 && <p className="text-[13px] text-muted">Belum ada dokumen.{edit && " Tambahkan lewat tombol di atas."}</p>}
              {list.map((d) => (
                <DocRow key={d.id} d={d} fileName={d.fileId ? fileName.get(d.fileId) : undefined} canEdit={edit} />
              ))}
            </section>
          );
        })}
      </div>

      <Note title={`Persyaratan bisa berbeda tiap ${office}`}>
        Checklist ini titik awal, bukan daftar resmi. Konfirmasi daftar final ke {office} tempat akad, terutama bila akad di luar domisili
        {office === "KUA" ? " (perlu surat rekomendasi nikah dari KUA asal)" : ""}. Scan KTP, KK, dan akta disimpan di penyimpanan privat dan
        bisa dihapus permanen kapan saja.
      </Note>
    </>
  );
}

function DocRow({ d, fileName, canEdit }: { d: Document; fileName?: string; canEdit: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-ground py-1.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{d.name}</p>
        {d.note && <p className="text-[12px] text-muted">{d.note}</p>}
      </div>
      {d.fileId && (
        <a
          href={`/api/files/${d.fileId}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Lihat scan ${d.name}`}
          title="Lihat scan"
          className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-ground"
        >
          <Eye size={16} aria-hidden="true" />
        </a>
      )}
      {!canEdit ? (
        <Status tone={d.status === "lengkap" ? "ok" : d.status === "diproses" ? "info" : "warn"}>
          {d.status === "lengkap" ? "Lengkap" : d.status === "diproses" ? "Diproses" : "Belum"}
        </Status>
      ) : (
        <>
          <DocStatus id={d.id} status={d.status} name={d.name} />
          <FormDialog
            variant="icon"
            triggerLabel={`Ubah ${d.name}`}
            title={d.name}
            action={updateDocument.bind(null, d.id)}
            trigger={<Pencil size={14} aria-hidden="true" />}
            footer={
              <span className="mr-auto flex flex-wrap gap-2">
                {d.fileId && (
                  <ActionButton
                    variant="danger"
                    confirm="Hapus scan ini secara permanen? File tidak bisa dipulihkan."
                    action={deleteDocumentFile.bind(null, d.id)}
                  >
                    Hapus scan
                  </ActionButton>
                )}
                <ActionButton variant="danger" confirm={`Hapus ${d.name} dari checklist?`} action={deleteDocument.bind(null, d.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                  Hapus
                </ActionButton>
              </span>
            }
          >
            <Field label="Nama dokumen">
              <Input name="name" required defaultValue={d.name} />
            </Field>
            <Field label="Status">
              <SelectField name="status" defaultValue={d.status} options={[{ value: "belum", label: "Belum" }, { value: "diproses", label: "Diproses" }, { value: "lengkap", label: "Lengkap" }]} />
            </Field>
            <Field label="Catatan">
              <Input name="note" defaultValue={d.note ?? ""} placeholder="Contoh: Ambil di kelurahan Senin" />
            </Field>
            <FileInput name="fileId" kind="document" label="Scan dokumen" current={d.fileId ? { id: d.fileId, name: fileName ?? "Scan" } : null} />
          </FormDialog>
        </>
      )}
    </div>
  );
}
