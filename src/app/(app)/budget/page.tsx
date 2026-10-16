import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { dateShort, dateShorter, dayMonth, diffDays, relativeDays, rupiah, rupiahShort, todayISO } from "@/lib/format";
import {
  addCategory,
  addExpense,
  addFunding,
  deleteCategory,
  deleteExpense,
  deleteFunding,
  payTerm,
  updateCategory,
  updateExpense,
  updateFunding,
} from "@/actions/budget";
import { ActionButton, FormDialog } from "@/components/forms";
import { FileInput } from "@/components/file-input";
import { Card, Empty, Field, Input, PageHeader, Progress, SectionTitle, Status, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import type { BudgetCategory, Expense, FundingSource } from "@/db/schema";

export const metadata: Metadata = { title: "Budget" };

const FUND_COLORS = ["#1C1B29", "#B9B2EE", "#5E5D70", "#E7C3A9", "#9FC2A8", "#C9C8D6"];
const SIDE_LABEL: Record<string, string> = { pengantin: "Pengantin", pria: "Keluarga pria", wanita: "Keluarga wanita", lainnya: "Lainnya" };

export default async function BudgetPage() {
  const ctx = await requirePage("budget");
  const wid = ctx.wedding.id;
  const today = todayISO();

  const [cats, funding, expenses, terms, files] = await Promise.all([
    db.select().from(schema.budgetCategory).where(eq(schema.budgetCategory.weddingId, wid)).orderBy(asc(schema.budgetCategory.sortOrder), asc(schema.budgetCategory.name)),
    db.select().from(schema.fundingSource).where(eq(schema.fundingSource.weddingId, wid)),
    db.select().from(schema.expense).where(eq(schema.expense.weddingId, wid)).orderBy(desc(schema.expense.date), desc(schema.expense.createdAt)),
    db
      .select({ term: schema.paymentTerm, vendor: schema.vendor })
      .from(schema.paymentTerm)
      .innerJoin(schema.vendor, eq(schema.paymentTerm.vendorId, schema.vendor.id))
      .where(eq(schema.paymentTerm.weddingId, wid))
      .orderBy(asc(schema.paymentTerm.dueDate)),
    db.select({ id: schema.file.id, name: schema.file.name }).from(schema.file).where(eq(schema.file.weddingId, wid)),
  ]);

  const fileName = new Map(files.map((f) => [f.id, f.name]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const spentBy = new Map<string, number>();
  for (const e of expenses) if (e.categoryId) spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? 0) + e.amount);
  const unpaid = terms.filter((t) => !t.term.paidAt);
  const boundBy = new Map<string, number>();
  for (const t of unpaid) if (t.vendor.categoryId) boundBy.set(t.vendor.categoryId, (boundBy.get(t.vendor.categoryId) ?? 0) + t.term.amount);

  const total = cats.reduce((s, c) => s + c.allocation, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const bound = unpaid.reduce((s, t) => s + t.term.amount, 0);
  const fundTotal = funding.reduce((s, f) => s + f.amount, 0);
  const highlight = unpaid[0]?.vendor.categoryId ?? null;

  return (
    <>
      <PageHeader
        title="Budget"
        description="Anggaran, pengeluaran, dan termin vendor dari dana pengantin dan kedua keluarga."
        actions={
          <>
            <FormDialog
              variant="secondary"
              title="Tambah kategori"
              action={addCategory}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Kategori
                </>
              }
            >
              <CategoryFields />
            </FormDialog>
            <FormDialog
              title="Catat pengeluaran"
              action={addExpense}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Catat pengeluaran
                </>
              }
            >
              <ExpenseFields cats={cats} funding={funding} today={today} />
            </FormDialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card tone="ink" className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[#c9c8d6]">Total anggaran</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(total)}</span>
          <span className="text-[12px] text-[#c9c8d6]">Dana tersedia {rupiahShort(fundTotal)}</span>
        </Card>
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Terpakai</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(spent)}</span>
          <span className="text-[12px] text-muted">{total ? `${Math.round((spent / total) * 100)}% dari anggaran` : "Anggaran belum diisi"}</span>
        </Card>
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Sisa</span>
          <span className={cx("text-[28px] font-extrabold leading-none tracking-[-0.02em]", total - spent < 0 && "text-warn-fg")}>
            {rupiahShort(total - spent)}
          </span>
          <span className="text-[12px] text-muted">{rupiahShort(bound)} sudah terikat termin</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-2" aria-labelledby="kat-title">
            <SectionTitle id="kat-title">Per kategori</SectionTitle>
            {cats.length === 0 ? (
              <Empty title="Belum ada kategori budget.">Tambahkan kategori seperti Gedung atau Catering beserta alokasinya.</Empty>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      <th scope="col" className="border-b border-line py-2.5 pr-3 font-semibold">Kategori</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Anggaran</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Terpakai</th>
                      <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Terikat termin</th>
                      <th scope="col" className="w-[28%] border-b border-line px-3 py-2.5 font-semibold">Progres</th>
                      <th scope="col" className="border-b border-line py-2.5"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => {
                      const s = spentBy.get(c.id) ?? 0;
                      const over = c.allocation > 0 && s > c.allocation;
                      return (
                        <tr key={c.id} className="border-b border-ground last:border-0">
                          <td className="py-2.5 pr-3 text-[14px] font-bold">{c.name}</td>
                          <td className="px-3 py-2.5 text-muted">{rupiahShort(c.allocation)}</td>
                          <td className={cx("px-3 py-2.5 font-bold", over && "text-warn-fg")}>{rupiahShort(s)}</td>
                          <td className="px-3 py-2.5">{boundBy.get(c.id) ? rupiahShort(boundBy.get(c.id)!) : "Tidak ada"}</td>
                          <td className="px-3 py-2.5">
                            <Progress
                              value={c.allocation ? (s / c.allocation) * 100 : s ? 100 : 0}
                              tone={c.id === highlight ? "accent" : "ink"}
                              label={`${c.name} terpakai`}
                            />
                            {over && <span className="mt-1 block text-[11px] font-bold text-warn-fg">Lewat {rupiahShort(s - c.allocation)}</span>}
                          </td>
                          <td className="whitespace-nowrap py-1 text-right">
                            <FormDialog
                              variant="icon"
                              triggerLabel={`Ubah ${c.name}`}
                              title={`Ubah kategori ${c.name}`}
                              action={updateCategory.bind(null, c.id)}
                              trigger={<Pencil size={15} aria-hidden="true" />}
                            >
                              <CategoryFields c={c} />
                            </FormDialog>
                            <ActionButton
                              variant="icon"
                              label={`Hapus ${c.name}`}
                              confirm={`Hapus kategori ${c.name}? Penawaran di kategori ini ikut terhapus. Pengeluaran tetap tersimpan tanpa kategori.`}
                              action={deleteCategory.bind(null, c.id)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </ActionButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {highlight && (
              <p className="text-[12px] text-muted">Bar berwarna aksen menandai kategori dengan termin terdekat.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-2" aria-labelledby="exp-title">
            <SectionTitle id="exp-title">Pengeluaran</SectionTitle>
            {expenses.length === 0 ? (
              <Empty title="Belum ada pengeluaran.">
                Catat setiap pembayaran beserta foto buktinya, atau tandai termin vendor sebagai lunas.
              </Empty>
            ) : (
              <ul className="flex flex-col">
                {expenses.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ground py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold">{e.description}</div>
                      <div className="text-[12px] text-muted">
                        {dateShort(e.date)}
                        {e.categoryId && catName.get(e.categoryId) ? `, ${catName.get(e.categoryId)}` : ""}
                      </div>
                    </div>
                    {e.receiptFileId && (
                      <a
                        href={`/api/files/${e.receiptFileId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hit-44 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold hover:bg-ground"
                      >
                        <Paperclip size={14} aria-hidden="true" />
                        Bukti
                      </a>
                    )}
                    <span className="text-[14px] font-extrabold tabular">{rupiah(e.amount)}</span>
                    <span className="flex">
                      <FormDialog
                        variant="icon"
                        triggerLabel={`Ubah ${e.description}`}
                        title="Ubah pengeluaran"
                        action={updateExpense.bind(null, e.id)}
                        trigger={<Pencil size={15} aria-hidden="true" />}
                      >
                        <ExpenseFields cats={cats} funding={funding} today={today} e={e} receiptName={e.receiptFileId ? fileName.get(e.receiptFileId) : undefined} />
                      </FormDialog>
                      <ActionButton
                        variant="icon"
                        label={`Hapus ${e.description}`}
                        confirm={e.paymentTermId ? "Hapus pengeluaran ini? Termin terkait akan kembali berstatus belum dibayar." : "Hapus pengeluaran ini?"}
                        action={deleteExpense.bind(null, e.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </ActionButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-3.5" aria-labelledby="dana-title">
            <SectionTitle
              id="dana-title"
              aside={
                <FormDialog variant="icon" triggerLabel="Tambah sumber dana" title="Tambah sumber dana" action={addFunding} trigger={<Plus size={18} aria-hidden="true" />}>
                  <FundingFields />
                </FormDialog>
              }
            >
              Sumber dana
            </SectionTitle>
            {funding.length === 0 ? (
              <p className="text-[13px] text-muted">Belum ada sumber dana. Catat tabungan pengantin dan kontribusi tiap keluarga.</p>
            ) : (
              <>
                <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
                  {funding.map((f, i) => (
                    <div key={f.id} style={{ width: `${fundTotal ? (f.amount / fundTotal) * 100 : 0}%`, background: FUND_COLORS[i % FUND_COLORS.length] }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {funding.map((f, i) => (
                    <li key={f.id} className="flex items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{f.name}</span>
                        <span className="block text-[11px] text-muted">{SIDE_LABEL[f.side]}</span>
                      </span>
                      <span className="font-bold">{rupiahShort(f.amount)}</span>
                      <FormDialog
                        variant="icon"
                        triggerLabel={`Ubah ${f.name}`}
                        title="Ubah sumber dana"
                        action={updateFunding.bind(null, f.id)}
                        trigger={<Pencil size={14} aria-hidden="true" />}
                        footer={
                          <ActionButton variant="danger" action={deleteFunding.bind(null, f.id)} confirm={`Hapus sumber dana ${f.name}?`} className="mr-auto">
                            Hapus
                          </ActionButton>
                        }
                      >
                        <FundingFields f={f} />
                      </FormDialog>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <section className="flex flex-col gap-2.5" aria-labelledby="termin-title">
            <SectionTitle id="termin-title">Termin berikutnya</SectionTitle>
            {unpaid.length === 0 ? (
              <Empty title="Tidak ada termin yang menunggu.">Termin muncul saat kamu memilih penawaran vendor atau menambah termin di halaman Vendor.</Empty>
            ) : (
              unpaid.map(({ term, vendor }) => {
                const dm = dayMonth(term.dueDate);
                const d = diffDays(today, term.dueDate);
                return (
                  <div key={term.id} className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3">
                    <div className="w-[46px] shrink-0 text-center">
                      <div className="text-[18px] font-extrabold leading-none">{dm.day}</div>
                      <div className="text-[11px] font-semibold text-muted">{dm.month}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">
                        {term.label} {vendor.name}
                      </div>
                      <div className="text-[12px] text-muted">{rupiah(term.amount)}</div>
                      <Status tone={d <= 7 ? "warn" : "neutral"} className="mt-1">
                        {relativeDays(term.dueDate, today)}
                      </Status>
                    </div>
                    <FormDialog
                      variant="ground"
                      size="sm"
                      title={`Tandai lunas: ${term.label} ${vendor.name}`}
                      description={`${rupiah(term.amount)}, jatuh tempo ${dateShorter(term.dueDate)}. Pembayaran dicatat sebagai pengeluaran.`}
                      action={payTerm.bind(null, term.id)}
                      submitLabel="Tandai lunas"
                      trigger="Lunas"
                    >
                      <Field label="Tanggal bayar">
                        <DateField name="date" defaultValue={today} />
                      </Field>
                      <FundingSelect funding={funding} />
                      <FileInput name="receiptFileId" kind="receipt" label="Bukti bayar (opsional)" />
                    </FormDialog>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function CategoryFields({ c }: { c?: BudgetCategory }) {
  return (
    <>
      <Field label="Nama kategori">
        <Input name="name" required defaultValue={c?.name} placeholder="Contoh: Catering" />
      </Field>
      <Field label="Alokasi" hint="Boleh ditulis 35000000, 35.000.000, atau 35jt.">
        <Input name="allocation" inputMode="numeric" defaultValue={c ? String(c.allocation) : ""} />
      </Field>
      <Field label="Kebutuhan" hint="Dipakai di perbandingan penawaran, misalnya 800 porsi prasmanan.">
        <Input name="need" defaultValue={c?.need ?? ""} />
      </Field>
    </>
  );
}

function FundingFields({ f }: { f?: FundingSource }) {
  return (
    <>
      <Field label="Nama sumber dana">
        <Input name="name" required defaultValue={f?.name} placeholder="Contoh: Tabungan pengantin" />
      </Field>
      <Field label="Pihak">
        <SelectField name="side" defaultValue={f?.side ?? "pengantin"} options={[...Object.entries(SIDE_LABEL).map(([id, n]) => ({ value: id, label: n }))]} />
      </Field>
      <Field label="Nominal">
        <Input name="amount" inputMode="numeric" required defaultValue={f ? String(f.amount) : ""} />
      </Field>
    </>
  );
}

function FundingSelect({ funding, value }: { funding: FundingSource[]; value?: string | null }) {
  return (
    <Field label="Dibayar dari">
      <SelectField name="fundingSourceId" defaultValue={value ?? ""} options={[{ value: "", label: "Tidak dicatat" }, ...funding.map((f) => ({ value: f.id, label: f.name }))]} />
    </Field>
  );
}

function ExpenseFields({
  cats,
  funding,
  today,
  e,
  receiptName,
}: {
  cats: BudgetCategory[];
  funding: FundingSource[];
  today: string;
  e?: Expense;
  receiptName?: string;
}) {
  return (
    <>
      <Field label="Keterangan">
        <Input name="description" required defaultValue={e?.description} placeholder="Contoh: Cetak undangan" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nominal">
          <Input name="amount" inputMode="numeric" required defaultValue={e ? String(e.amount) : ""} placeholder="Rp" />
        </Field>
        <Field label="Tanggal">
          <DateField name="date" defaultValue={e?.date ?? today} />
        </Field>
      </div>
      <Field label="Kategori">
        <SelectField name="categoryId" defaultValue={e?.categoryId ?? ""} options={[{ value: "", label: "Tanpa kategori" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
      </Field>
      <FundingSelect funding={funding} value={e?.fundingSourceId} />
      <FileInput
        name="receiptFileId"
        kind="receipt"
        label="Foto bukti (opsional)"
        current={e?.receiptFileId ? { id: e.receiptFileId, name: receiptName ?? "Bukti" } : null}
      />
    </>
  );
}
