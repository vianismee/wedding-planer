import Link from "next/link";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { addDeposit, deleteDeposit, deleteGoal, updateDeposit, updateGoal } from "@/actions/budget";
import { ActionButton, FormDialog } from "@/components/forms";
import { Card, Empty, Field, Input, Progress, Status, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { dateShort, rupiah, rupiahShort } from "@/lib/format";
import { balanceOf, FREQ_LABEL, FREQUENCIES, PER_LABEL, planFor, planPoints } from "@/lib/savings";
import type { SavingsDeposit, SavingsGoal } from "@/db/schema";
import { SavingsChart } from "./savings-chart";

export const SIDE_LABEL: Record<string, string> = { pengantin: "Pengantin", pria: "Keluarga pria", wanita: "Keluarga wanita", lainnya: "Lainnya" };

/** Urut tanggal lalu waktu dicatat, supaya saldo berjalan sama dengan urutan kejadian. */
const byTime = (a: SavingsDeposit, b: SavingsDeposit) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime();

export function SavingsTab({
  goals,
  deposits,
  edit,
  today,
  akadDate,
  selected,
}: {
  goals: SavingsGoal[];
  deposits: SavingsDeposit[];
  edit: boolean;
  today: string;
  akadDate: string;
  /** Id tabungan dari ?g=. Kosong atau tidak dikenal berarti tabungan pertama. */
  selected?: string;
}) {
  if (goals.length === 0)
    return (
      <Empty title="Belum ada tabungan.">
        {edit
          ? "Tambah target tiap pihak, misalnya pihak pria Rp 25 jt dengan setoran bulanan, lalu catat setoran dan penarikannya."
          : "Tabungan akan muncul di sini setelah ditambahkan."}
      </Empty>
    );

  const saved = balanceOf(deposits);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const current = goals.find((g) => g.id === selected) ?? goals[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card tone="ink" className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[#c9c8d6]">Terkumpul</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(saved)}</span>
          <span className="text-[12px] text-[#c9c8d6]">dari {goals.length} tabungan</span>
        </Card>
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Target</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(target)}</span>
          <span className="text-[12px] text-muted">{target ? `${Math.round((saved / target) * 100)}% tercapai` : "Target belum diisi"}</span>
        </Card>
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Masih kurang</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(Math.max(0, target - saved))}</span>
          <span className="text-[12px] text-muted">Total semua pihak</span>
        </Card>
      </div>

      {/* Satu tabungan tampil sekaligus; pilihannya ikut URL supaya tetap terpilih setelah menyimpan. */}
      {goals.length > 1 && (
        <nav aria-label="Pilih tabungan" className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
          {goals.map((g) => {
            const bal = balanceOf(deposits.filter((d) => d.goalId === g.id));
            const on = g.id === current.id;
            return (
              <Link
                key={g.id}
                href={`/budget?tab=tabungan&g=${g.id}`}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex min-w-[168px] shrink-0 flex-col gap-1.5 rounded-xl border px-3.5 py-2.5 no-underline transition-colors duration-150",
                  on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-ink",
                )}
              >
                <span className="truncate text-[13px] font-bold">{g.name}</span>
                <span className={cx("text-[11px]", on ? "text-[#c9c8d6]" : "text-muted")}>
                  {SIDE_LABEL[g.side]} · <span className="tabular">{rupiahShort(bal)}</span> / <span className="tabular">{rupiahShort(g.target)}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <GoalCard
        key={current.id}
        g={current}
        rows={deposits.filter((d) => d.goalId === current.id).sort(byTime)}
        edit={edit}
        today={today}
        akadDate={akadDate}
      />
    </div>
  );
}

function GoalCard({ g, rows, edit, today, akadDate }: { g: SavingsGoal; rows: SavingsDeposit[]; edit: boolean; today: string; akadDate: string }) {
  const balance = balanceOf(rows);
  const p = planFor(g, balance, today, akadDate);
  const per = PER_LABEL[p.frequency];
  const totalIn = rows.filter((r) => r.kind !== "keluar").reduce((s, r) => s + r.amount, 0);
  const totalOut = totalIn - balance;

  // Saldo berjalan per transaksi, untuk tabel dan grafik.
  const running = rows.map((r, i) => ({ r, saldo: balanceOf(rows.slice(0, i + 1)) }));
  const start = rows[0] && rows[0].date < g.startDate ? rows[0].date : g.startDate;
  const points = [{ date: start, value: 0 }, ...running.map(({ r, saldo }) => ({ date: r.date, value: saldo }))];

  return (
    <Card className="flex flex-col gap-4" aria-labelledby={`tabungan-${g.id}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 id={`tabungan-${g.id}`} className="text-[18px] font-extrabold leading-tight">
            {g.name}
          </h2>
          <p className="text-[12px] text-muted">
            {SIDE_LABEL[g.side]}, setoran {FREQ_LABEL[p.frequency].toLowerCase()} sampai {dateShort(p.due)}
          </p>
        </div>
        {edit && (
          <div className="flex flex-wrap items-center gap-2">
            <FormDialog
              variant="primary"
              size="sm"
              title={`Setor ke ${g.name}`}
              description={p.remaining ? `Sisa target ${rupiah(p.remaining)}.` : "Target sudah tercapai."}
              action={addDeposit.bind(null, g.id)}
              submitLabel="Catat setoran"
              trigger={
                <>
                  <Plus size={14} aria-hidden="true" />
                  Setor
                </>
              }
            >
              <TxFields kind="masuk" today={today} suggest={p.neededNow} />
            </FormDialog>
            {balance > 0 && (
              <FormDialog
                variant="ground"
                size="sm"
                title={`Tarik dari ${g.name}`}
                description={`Saldo ${rupiah(balance)}. Penarikan tercatat sebagai pengeluaran tabungan.`}
                action={addDeposit.bind(null, g.id)}
                submitLabel="Catat penarikan"
                trigger={
                  <>
                    <Minus size={14} aria-hidden="true" />
                    Tarik
                  </>
                }
              >
                <TxFields kind="keluar" today={today} />
              </FormDialog>
            )}
            <FormDialog
              variant="icon"
              triggerLabel={`Ubah ${g.name}`}
              title="Ubah tabungan"
              action={updateGoal.bind(null, g.id)}
              trigger={<Pencil size={15} aria-hidden="true" />}
              footer={
                <ActionButton variant="danger" action={deleteGoal.bind(null, g.id)} confirm={`Hapus tabungan ${g.name}? Semua transaksinya ikut terhapus.`} className="mr-auto">
                  Hapus
                </ActionButton>
              }
            >
              <GoalFields g={g} today={today} />
            </FormDialog>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[24px] font-extrabold leading-none tracking-[-0.02em] tabular">
            {rupiahShort(balance)} <span className="text-[14px] font-semibold text-muted">dari {rupiahShort(g.target)}</span>
          </span>
          {p.status === "tercapai" && <Status tone="ok">Tercapai</Status>}
          {p.status === "sesuai" && <Status tone="ok">Sesuai rencana</Status>}
          {p.status === "tertinggal" && <Status tone="warn">Tertinggal {rupiahShort(p.expected - balance)}</Status>}
          {p.status === "lewat" && <Status tone="warn">Belum tercapai</Status>}
        </div>
        <Progress value={g.target ? (balance / g.target) * 100 : 0} label={`${g.name} terkumpul`} />
        <p className="text-[13px] text-muted">
          {p.status === "tercapai"
            ? "Target sudah tercapai."
            : p.status === "lewat"
              ? `Lewat tanggal target, kurang ${rupiahShort(p.remaining)}.`
              : `Rencana ${rupiahShort(p.perPeriod)} ${per}. Perlu ${rupiahShort(p.neededNow)} ${per} mulai sekarang supaya tercapai tepat waktu.`}
        </p>
      </div>

      <SavingsChart name={g.name} balance={points} plan={planPoints(g, akadDate)} today={today} />

      {rows.length === 0 ? (
        <p className="rounded-[14px] bg-sunken p-4 text-[13px] text-muted">Belum ada transaksi.{edit && " Catat setoran pertama lewat tombol Setor."}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <caption className="sr-only">Transaksi {g.name}</caption>
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th scope="col" className="border-b border-line py-2.5 pr-3 font-semibold">Tanggal</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Keterangan</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Pemasukan</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Pengeluaran</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Saldo</th>
                {edit && <th scope="col" className="border-b border-line py-2.5"><span className="sr-only">Aksi</span></th>}
              </tr>
            </thead>
            <tbody>
              {/* Terbaru di atas; saldo tetap saldo setelah transaksi itu. */}
              {[...running].reverse().map(({ r, saldo }) => (
                <tr key={r.id} className="border-b border-ground">
                  <td className="whitespace-nowrap py-2.5 pr-3">{dateShort(r.date)}</td>
                  <td className="px-3 py-2.5 text-muted">{r.note || (r.kind === "keluar" ? "Penarikan" : "Setoran")}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular">{r.kind === "keluar" ? "" : rupiah(r.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular text-warn-fg">{r.kind === "keluar" ? rupiah(r.amount) : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular">{rupiah(saldo)}</td>
                  {edit && (
                    <td className="whitespace-nowrap py-1 text-right">
                      <FormDialog
                        variant="icon"
                        triggerLabel={`Ubah transaksi ${dateShort(r.date)}`}
                        title="Ubah transaksi"
                        action={updateDeposit.bind(null, r.id)}
                        trigger={<Pencil size={15} aria-hidden="true" />}
                      >
                        <TxFields d={r} today={today} />
                      </FormDialog>
                      <ActionButton
                        variant="icon"
                        label={`Hapus transaksi ${dateShort(r.date)}`}
                        confirm={`Hapus ${r.kind === "keluar" ? "penarikan" : "setoran"} ${rupiah(r.amount)} tanggal ${dateShort(r.date)}?`}
                        action={deleteDeposit.bind(null, r.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </ActionButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-[13px]">
                <th scope="row" colSpan={2} className="py-2.5 pr-3 text-left font-bold">
                  Total
                </th>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular">{rupiah(totalIn)}</td>
                <td className={cx("whitespace-nowrap px-3 py-2.5 text-right font-bold tabular", totalOut > 0 && "text-warn-fg")}>{rupiah(totalOut)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold tabular">{rupiah(balance)}</td>
                {edit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Isian transaksi. Saat menambah, jenisnya dari tombol (Setor/Tarik); saat mengubah, jenisnya bisa diganti. */
function TxFields({ d, kind, today, suggest }: { d?: SavingsDeposit; kind?: "masuk" | "keluar"; today: string; suggest?: number }) {
  const k = d?.kind ?? kind ?? "masuk";
  return (
    <>
      {d ? (
        <Field label="Jenis">
          <SelectField name="kind" defaultValue={k} options={[{ value: "masuk", label: "Pemasukan (setoran)" }, { value: "keluar", label: "Pengeluaran (penarikan)" }]} />
        </Field>
      ) : (
        <input type="hidden" name="kind" value={k} />
      )}
      <Field label="Nominal" hint="Boleh ditulis 500000, 500.000, atau 500rb.">
        <Input name="amount" inputMode="numeric" required defaultValue={d ? String(d.amount) : suggest ? String(suggest) : ""} />
      </Field>
      <Field label="Tanggal">
        <DateField name="date" defaultValue={d?.date ?? today} />
      </Field>
      <Field label="Keterangan (opsional)">
        <Input name="note" maxLength={160} defaultValue={d?.note ?? ""} placeholder={k === "keluar" ? "Contoh: DP gedung" : "Contoh: gaji Maret"} />
      </Field>
    </>
  );
}

export function GoalFields({ g, today }: { g?: SavingsGoal; today: string }) {
  return (
    <>
      <Field label="Nama tabungan">
        <Input name="name" required defaultValue={g?.name} placeholder="Contoh: Tabungan pihak pria" />
      </Field>
      <Field label="Pihak">
        <SelectField name="side" defaultValue={g?.side ?? "pengantin"} options={Object.entries(SIDE_LABEL).map(([id, n]) => ({ value: id, label: n }))} />
      </Field>
      <Field label="Target" hint="Boleh ditulis 25000000, 25.000.000, atau 25jt.">
        <Input name="target" inputMode="numeric" required defaultValue={g ? String(g.target) : ""} />
      </Field>
      <Field label="Rencana setoran" hint="Nominal per periode dihitung otomatis dari target dan tanggalnya.">
        <SelectField name="frequency" defaultValue={g?.frequency ?? "bulanan"} options={FREQUENCIES.map((f) => ({ value: f, label: FREQ_LABEL[f] }))} />
      </Field>
      <Field label="Mulai menabung">
        <DateField name="startDate" defaultValue={g?.startDate ?? today} />
      </Field>
      <Field label="Target tercapai pada" hint="Kosongkan untuk memakai tanggal akad.">
        <DateField name="dueDate" defaultValue={g?.dueDate ?? undefined} clearable placeholder="Tanggal akad" />
      </Field>
    </>
  );
}
