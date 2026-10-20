"use client";

import { useActionState, useState } from "react";
import { Check, ChevronRight, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { addTerm, deleteTerm, updateTerm } from "@/actions/budget";
import { cancelOffer, deleteVendor, setVendorShare, updateVendor } from "@/actions/vendor";
import { ActionButton, Feedback, FormDialog, Modal, submitWith, type ActionResult } from "@/components/forms";
import { CopyLink } from "@/components/copy-link";
import { CreatableSelect } from "@/components/creatable-select";
import { DateField } from "@/components/date-field";
import { Button, Field, Input, Status } from "@/components/kit";
import { dateShort, relativeDays, rupiah, rupiahShort, todayISO, diffDays } from "@/lib/format";
import { addonsTotal } from "@/lib/offer";
import type { PaymentTerm, Vendor } from "@/db/schema";
import { VendorFields } from "./offer-fields";

type Cat = { id: string; name: string };

export function vendorSummary(v: Pick<Vendor, "includeItems" | "addons" | "packageName">) {
  return [
    v.packageName,
    v.includeItems.length ? `${v.includeItems.length} item termasuk` : null,
    v.addons.length ? `${v.addons.length} add-on` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Nama vendor yang bisa diklik untuk membuka detail pesanan lengkap. */
export function VendorDetail({
  v,
  terms,
  cats,
  categoryName,
  paid,
  rest,
  unscheduled,
  baseUrl,
  canEdit,
  canEditTerms,
}: {
  canEdit: boolean;
  canEditTerms: boolean;
  v: Vendor;
  terms: PaymentTerm[];
  cats: Cat[];
  categoryName: string;
  paid: number;
  rest: number;
  unscheduled: number;
  baseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const today = todayISO();
  const close = () => {
    setOpen(false);
    setEditing(false);
  };
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await updateVendor(v.id, fd);
    if (r.ok) setEditing(false);
    return r;
  }, null);
  const summary = vendorSummary(v);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-sunken"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-muted">{categoryName}</span>
          <span className="block text-[14px] font-bold underline-offset-2 group-hover:underline">{v.name}</span>
          {summary && <span className="block truncate text-[12px] text-muted">{summary}</span>}
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
      </button>

      <Modal open={open} onClose={close} wide title={editing ? `Ubah ${v.name}` : v.name} description={editing ? undefined : [categoryName, v.packageName].filter(Boolean).join(", ")}>
        {editing ? (
          <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
            <VendorFields cats={cats} v={v} />
            {state && !state.ok && <Feedback state={state} />}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ground" onClick={() => setEditing(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 min-[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Kolom kiri: paket */}
            <div className="flex min-w-0 flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2">
                <Stat label="Total" value={rupiahShort(v.totalPrice)} strong />
                <Stat label="Terbayar" value={rupiahShort(paid)} />
                <Stat label="Sisa" value={rupiahShort(rest)} />
              </dl>

              <section className="flex flex-col gap-2" aria-labelledby={`isi-${v.id}`}>
                <h3 id={`isi-${v.id}`} className="text-[13px] font-bold">
                  Isi paket
                </h3>
                {v.includeItems.length ? (
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {v.includeItems.map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <Check size={15} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden="true" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">Belum diisi.{canEdit && " Tambahkan lewat tombol Ubah."}</p>
                )}
              </section>

              <section className="flex flex-col gap-1.5 rounded-[14px] bg-sunken p-3.5 text-[13px]" aria-label="Rincian harga">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Harga paket</span>
                  <span className="font-semibold tabular">{rupiah(v.packagePrice)}</span>
                </div>
                {v.addons.map((a, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 text-muted">
                      {a.label}
                      {a.qty > 1 ? ` x${a.qty}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold tabular">{rupiah(a.qty * a.price)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2">
                  <span className="font-bold">Total{v.addons.length ? ` (add-on ${rupiahShort(addonsTotal(v.addons))})` : ""}</span>
                  <span className="font-extrabold tabular">{rupiah(v.totalPrice)}</span>
                </div>
              </section>

              <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold text-muted">Kontak</dt>
                  <dd className="font-semibold">{v.contact || "Belum diisi"}</dd>
                </div>
                {v.packageDesc && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold text-muted">Catatan</dt>
                    <dd className="whitespace-pre-line">{v.packageDesc}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Kolom kanan: termin dan link */}
            <div className="flex min-w-0 flex-col gap-4">
              <section className="flex flex-col gap-2" aria-labelledby={`termin-${v.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 id={`termin-${v.id}`} className="text-[13px] font-bold">
                    Termin pembayaran
                  </h3>
                  {canEditTerms && (
                    <FormDialog
                      variant="ground"
                      size="sm"
                      title={`Tambah termin ${v.name}`}
                      action={addTerm.bind(null, v.id)}
                      trigger={
                        <>
                          <Plus size={14} aria-hidden="true" />
                          Termin
                        </>
                      }
                    >
                      <TermFields defaultAmount={unscheduled} />
                    </FormDialog>
                  )}
                </div>
                {terms.length === 0 ? (
                  <p className="text-[13px] text-muted">Belum ada termin.{canEditTerms && " Tambahkan DP, cicilan, atau pelunasan."}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {terms.map((t) => {
                      const d = diffDays(today, t.dueDate);
                      return (
                        <li key={t.id} className="flex items-center gap-2 rounded-[14px] bg-sunken py-1.5 pl-3 pr-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold">
                              {t.label} <span className="font-semibold tabular">{rupiah(t.amount)}</span>
                            </div>
                            <div className="text-[12px] text-muted">{t.paidAt ? `Dibayar ${dateShort(t.paidAt)}` : `Jatuh tempo ${dateShort(t.dueDate)}`}</div>
                          </div>
                          {t.paidAt ? (
                            <Status tone="ok" className="mr-2">
                              Lunas
                            </Status>
                          ) : (
                            <>
                              <Status tone={d <= 7 ? "warn" : "neutral"} className={canEditTerms ? undefined : "mr-2"}>
                                {relativeDays(t.dueDate, today)}
                              </Status>
                              {canEditTerms && (
                                <>
                                  <FormDialog
                                    variant="icon"
                                    triggerLabel={`Ubah termin ${t.label}`}
                                    title={`Ubah termin ${t.label}`}
                                    action={updateTerm.bind(null, t.id)}
                                    trigger={<Pencil size={14} aria-hidden="true" />}
                                  >
                                    <TermFields t={t} />
                                  </FormDialog>
                                  <ActionButton variant="icon" label={`Hapus termin ${t.label}`} confirm={`Hapus termin ${t.label}?`} action={deleteTerm.bind(null, t.id)}>
                                    <Trash2 size={14} aria-hidden="true" />
                                  </ActionButton>
                                </>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {unscheduled > 0 && <p className="text-[12px] font-semibold text-warn-fg">{rupiah(unscheduled)} belum dijadwalkan sebagai termin.</p>}
                {canEditTerms && <p className="text-[12px] text-muted">Tandai termin lunas di halaman Budget.</p>}
              </section>

              <section className="flex flex-col gap-2 rounded-[14px] border border-line p-3.5" aria-labelledby={`share-${v.id}`}>
                <h3 id={`share-${v.id}`} className="flex items-center gap-1.5 text-[13px] font-bold">
                  <Link2 size={15} aria-hidden="true" />
                  Link untuk vendor
                </h3>
                {v.shareToken ? (
                  <>
                    <p className="text-[12px] text-muted">
                      Vendor bisa melihat ringkasan pesanan, tanggal acara, dan jadwal pembayaran tanpa login. Budget, tamu, dan dokumen tidak ikut terlihat.
                    </p>
                    <CopyLink url={`${baseUrl}/v/${v.shareToken}`} />
                    {canEdit && (
                      <ActionButton variant="outline" size="sm" className="self-start" action={setVendorShare.bind(null, v.id, false)}>
                        Cabut link
                      </ActionButton>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[12px] text-muted">
                      {canEdit ? "Buat link baca-saja untuk dikirim ke vendor lewat WhatsApp sebagai konfirmasi pesanan." : "Belum ada link untuk vendor ini."}
                    </p>
                    {canEdit && (
                      <ActionButton variant="primary" size="sm" className="self-start" action={setVendorShare.bind(null, v.id, true)}>
                        Buat link untuk vendor
                      </ActionButton>
                    )}
                  </>
                )}
              </section>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ground pt-4 min-[760px]:col-span-2">
                {v.offerId ? (
                  // Vendor dari penawaran: batalkan pesanan, penawarannya kembali ke perbandingan.
                  <ActionButton
                    variant="danger"
                    confirm={`Batalkan pesanan ${v.name}? Termin DP dan pelunasan dihapus, penawarannya kembali ke perbandingan. Pengeluaran yang sudah dibayar tetap tercatat di Budget.`}
                    confirmLabel="Batalkan pesanan"
                    action={async () => {
                      const r = await cancelOffer(v.offerId!);
                      if (r.ok) close();
                      return r;
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                    Batalkan pesanan
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="danger"
                    confirm={`Hapus vendor ${v.name} beserta termin yang belum dibayar? Pengeluaran yang sudah tercatat tetap ada.`}
                    action={async () => {
                      const r = await deleteVendor(v.id);
                      if (r.ok) close();
                      return r;
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Hapus vendor
                  </ActionButton>
                )}
                <Button variant="ground" onClick={() => setEditing(true)}>
                  <Pencil size={14} aria-hidden="true" />
                  Ubah vendor
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-[14px] bg-ink p-3 text-white" : "rounded-[14px] bg-sunken p-3"}>
      <dt className={strong ? "text-[11px] font-semibold text-[#c9c8d6]" : "text-[11px] font-semibold text-muted"}>{label}</dt>
      <dd className="text-[17px] font-extrabold tabular">{value}</dd>
    </div>
  );
}

export function TermFields({ t, defaultAmount }: { t?: PaymentTerm; defaultAmount?: number }) {
  return (
    <>
      <Field label="Nama termin">
        <CreatableSelect
          name="label"
          options={["DP", "Termin 2", "Termin 3", "Pelunasan"]}
          defaultValue={t?.label ?? ""}
          placeholder="DP, termin, atau pelunasan"
          createLabel="Pakai nama"
          searchPlaceholder="Cari atau ketik nama termin"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nominal">
          <Input name="amount" inputMode="numeric" required defaultValue={t ? String(t.amount) : defaultAmount ? String(defaultAmount) : ""} />
        </Field>
        <Field label="Jatuh tempo" hint="Pengingat email dikirim H-7 dan H-1.">
          <DateField name="dueDate" defaultValue={t?.dueDate ?? ""} />
        </Field>
      </div>
    </>
  );
}
