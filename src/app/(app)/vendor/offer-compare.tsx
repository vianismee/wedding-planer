"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { addOffer, cancelOffer, chooseOffer, deleteOffer, trackCompare, updateOffer } from "@/actions/vendor";
import { ActionButton, FormDialog, Modal, type ActionResult, submitWith } from "@/components/forms";
import { useConfirm } from "@/components/confirm";
import { Button, Field, Status, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { rupiah, rupiahShort } from "@/lib/format";
import type { Offer } from "@/db/schema";
import { addonsTotal, dpLabel, dpText, dpValue, offerTotal } from "@/lib/offer";
import { OfferFields } from "./offer-fields";

type Cat = { id: string; name: string; allocation: number; need: string | null };

export function OfferCompare({
  cats,
  offers,
  bookedCats,
  initialCat,
  fileNames,
  defaults,
}: {
  cats: Cat[];
  offers: Offer[];
  bookedCats: string[];
  initialCat?: string;
  fileNames: Record<string, string>;
  defaults: { dpDue: string; settleDue: string };
}) {
  // Kategori dengan penawaran tampil lebih dulu.
  const tabs = useMemo(() => {
    const count = (id: string) => offers.filter((o) => o.categoryId === id).length;
    return [...cats].sort((a, b) => Number(count(b.id) > 0) - Number(count(a.id) > 0)).map((c) => ({ ...c, count: count(c.id) }));
  }, [cats, offers]);
  const [catId, setCatId] = useState<string | undefined>(
    (initialCat && cats.some((c) => c.id === initialCat) ? initialCat : undefined) ?? tabs[0]?.id,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (catId && offers.some((o) => o.categoryId === catId)) trackCompare(catId).catch(() => {});
  }, [catId, offers]);

  const cat = cats.find((c) => c.id === catId);
  const list = offers.filter((o) => o.categoryId === catId);
  const min = list.length > 1 ? Math.min(...list.map(offerTotal)) : null;
  const chosen = list.find((o) => o.status === "dipilih");
  const pickedOffer = list.find((o) => o.id === picked) ?? null;
  const booked = catId ? bookedCats.includes(catId) : false;

  if (cats.length === 0)
    return (
      <section className="rounded-[24px] bg-surface p-5">
        <h2 className="text-[18px] font-bold">Bandingkan penawaran</h2>
        <p className="mt-1 text-[13px] text-muted">
          Belum ada kategori budget. Tambahkan kategori di halaman Budget, lalu bandingkan penawaran per kategori di sini.
        </p>
      </section>
    );

  let summary = cat
    ? `Belum ada yang dipilih. Bandingkan harga terhadap alokasi ${rupiahShort(cat.allocation)}, lalu pilih satu penawaran.`
    : "";
  if (chosen) summary = `${chosen.vendorName} sudah dipesan untuk ${cat?.name}.`;
  if (pickedOffer)
    summary = `${pickedOffer.vendorName} dipilih. Total ${rupiahShort(offerTotal(pickedOffer))}, ${
      dpValue(pickedOffer) > 0 ? `DP ${rupiahShort(dpValue(pickedOffer))} saat booking` : "tanpa DP"
    }.`;

  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-surface p-4 sm:p-5" aria-labelledby="cmp-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="cmp-title" className="text-[18px] font-bold">
            Bandingkan penawaran
          </h2>
          {cat && (
            <p className="text-[13px] text-muted">
              {cat.name}
              {cat.need ? `: ${cat.need}` : ""}. Alokasi budget {rupiahShort(cat.allocation)}.
            </p>
          )}
        </div>
        {cat && (
          <FormDialog
            title={`Tambah penawaran ${cat.name}`}
            action={addOffer}
            trigger={
              <>
                <Plus size={16} aria-hidden="true" />
                Tambah penawaran
              </>
            }
            wide
          >
            <OfferFields cats={cats} categoryId={cat.id} />
          </FormDialog>
        )}
      </div>

      <div role="group" aria-label="Kategori" className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-ground p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === catId}
            onClick={() => {
              setCatId(t.id);
              setPicked(null);
              setSaved(null);
            }}
            className={cx(
              "flex h-12 shrink-0 flex-col items-start justify-center rounded-[10px] px-3.5 text-left transition-colors duration-150",
              t.id === catId ? "bg-ink text-white" : "text-ink hover:bg-surface",
            )}
          >
            <span className="text-[13px] font-bold leading-tight">{t.name}</span>
            <span className={cx("text-[11px] font-semibold leading-tight", t.id === catId ? "text-[#c9c8d6]" : "text-muted")}>
              {t.count} penawaran
            </span>
          </button>
        ))}
      </div>

      {saved && (
        <Alert variant="ok">
<AlertDescription>{saved}{" "}
          <a href="/budget" className="underline">
            Lihat termin di Budget
          </a></AlertDescription>
</Alert>
      )}

      {list.length === 0 ? (
        <div className="rounded-[18px] bg-sunken p-5">
          <p className="text-[14px] font-bold">Belum ada penawaran untuk {cat?.name}.</p>
          <p className="text-[13px] text-muted">Tambahkan penawaran pertama untuk mulai membandingkan.</p>
        </div>
      ) : (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {list.map((o) => {
            const isPicked = o.id === picked;
            const isChosen = o.status === "dipilih";
            const selected = isPicked || (isChosen && !picked);
            const total = offerTotal(o);
            const d = cat ? total - cat.allocation : 0;
            return (
              <article
                key={o.id}
                className={cx(
                  "flex min-w-[240px] flex-1 snap-start flex-col gap-2.5 rounded-[18px] border-2 p-4",
                  selected ? "border-ink bg-surface" : "border-transparent bg-sunken",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-bold">{o.vendorName}</h3>
                    {o.packageName && <p className="text-[12px] text-muted">{o.packageName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {min !== null && total === min && <Status tone="ok">Termurah</Status>}
                    {selected && <Status tone="accent">{isChosen && !isPicked ? "Dipesan" : "Dipilih"}</Status>}
                  </div>
                </div>
                <div>
                  <div className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em]">{rupiahShort(total)}</div>
                  {o.addons.length > 0 && (
                    <div className="text-[12px] text-muted">
                      Paket {rupiahShort(o.price)} + {o.addons.length} add-on {rupiahShort(addonsTotal(o.addons))}
                    </div>
                  )}
                </div>
                {cat && cat.allocation > 0 && (
                  <div className={cx("text-[12px] font-bold", d < 0 ? "text-ok-fg" : d > 0 ? "text-warn-fg" : "text-muted")}>
                    {d < 0 ? `${rupiahShort(-d)} di bawah alokasi` : d > 0 ? `${rupiahShort(d)} di atas alokasi` : "Pas dengan alokasi"}
                  </div>
                )}
                <dl className="flex flex-col gap-2 border-t border-line pt-2.5 text-[13px]">
                  <Row label="Termasuk">
                    {o.includeItems.length ? (
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {o.includeItems.map((it, i) => (
                          <li key={i} className="flex gap-1.5">
                            <Check size={14} className="mt-[3px] shrink-0 text-ok-fg" aria-hidden="true" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "Belum diisi"
                    )}
                  </Row>
                  {o.addons.length > 0 && (
                    <Row label="Add-on di luar paket">
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {o.addons.map((a, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="min-w-0">
                              {a.label}
                              {a.qty > 1 ? ` x${a.qty}` : ""}
                            </span>
                            <span className="shrink-0 tabular">{rupiahShort(a.qty * a.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </Row>
                  )}
                  <Row label="DP saat booking">
                    {dpText(o)}
                  </Row>
                  <Row label="Ketersediaan">
                    <span className={o.available ? "" : "text-warn-fg"}>{o.availability || (o.available ? "Tersedia" : "Belum dikonfirmasi")}</span>
                  </Row>
                  {o.notes && <Row label="Catatan">{o.notes}</Row>}
                  {o.attachmentFileId && (
                    <Row label="Lampiran">
                      <a href={`/api/files/${o.attachmentFileId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                        <Paperclip size={13} aria-hidden="true" />
                        {fileNames[o.attachmentFileId] ?? "Buka lampiran"}
                      </a>
                    </Row>
                  )}
                </dl>
                <div className="mt-auto flex items-center gap-1 pt-1">
                  {isChosen ? (
                    <ActionButton
                      variant="outline"
                      className="flex-1"
                      confirm={`Batalkan pesanan ${o.vendorName}? Vendor dan termin DP serta pelunasannya dihapus, penawarannya tetap ada. Pengeluaran yang sudah dibayar tetap tercatat di Budget.`}
                      confirmLabel="Batalkan pesanan"
                      action={async () => {
                        const r = await cancelOffer(o.id);
                        if (r.ok) setSaved(null);
                        return r;
                      }}
                    >
                      Batalkan pesanan
                    </ActionButton>
                  ) : (
                    <Button
                      variant={isPicked ? "outline" : "primary"}
                      aria-pressed={isPicked}
                      className="flex-1"
                      onClick={() => {
                        setPicked(isPicked ? null : o.id);
                        setSaved(null);
                      }}
                    >
                      {isPicked ? "Batalkan pilihan" : "Pilih penawaran ini"}
                    </Button>
                  )}
                  <FormDialog
                    variant="icon"
                    triggerLabel={`Ubah penawaran ${o.vendorName}`}
                    title={`Ubah penawaran ${o.vendorName}`}
                    action={updateOffer.bind(null, o.id)}
                    trigger={<Pencil size={15} aria-hidden="true" />}
                    wide
                  >
                    <OfferFields cats={cats} categoryId={o.categoryId} o={o} fileName={o.attachmentFileId ? fileNames[o.attachmentFileId] : undefined} />
                  </FormDialog>
                  <DeleteOffer o={o} onDone={() => picked === o.id && setPicked(null)} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {list.length > 0 && (
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-ground p-3.5",
            pickedOffer &&
              "rise max-[899px]:fixed max-[899px]:inset-x-3 max-[899px]:z-20 max-[899px]:bg-surface max-[899px]:shadow-bar",
          )}
          style={pickedOffer ? { bottom: "calc(96px + env(safe-area-inset-bottom))" } : undefined}
        >
          <p className="min-w-0 flex-1 text-[13px] font-semibold">{summary}</p>
          {pickedOffer && (
            <Button onClick={() => setSaving(true)}>{booked ? "Simpan sebagai vendor tambahan" : "Simpan pilihan"}</Button>
          )}
        </div>
      )}

      {pickedOffer && (
        <SaveDialog
          open={saving}
          offer={pickedOffer}
          defaults={defaults}
          onClose={() => setSaving(false)}
          onSaved={(msg) => {
            setSaving(false);
            setPicked(null);
            setSaved(msg);
          }}
        />
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function DeleteOffer({ o, onDone }: { o: Offer; onDone: () => void }) {
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Hapus penawaran ${o.vendorName}`}
      onClick={async () => {
        const yes = await dialogs.confirm({ title: `Hapus penawaran ${o.vendorName}?`, confirmLabel: "Hapus", destructive: true });
        if (!yes) return;
        start(async () => {
          const r = await deleteOffer(o.id);
          if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
          else onDone();
        });
      }}
      className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-ground disabled:opacity-50"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

function SaveDialog({
  open,
  offer,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean;
  offer: Offer;
  defaults: { dpDue: string; settleDue: string };
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const total = offerTotal(offer);
  const dp = dpValue(offer);
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await chooseOffer(offer.id, fd);
    if (r.ok) onSaved(r.message ?? "Tersimpan.");
    return r;
  }, null);
  return (
    <Modal open={open} onClose={onClose} title={`Pesan ${offer.vendorName}`} description="Penawaran menjadi vendor terpesan dan termin pembayarannya masuk ke Budget.">
      <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 rounded-[14px] bg-sunken p-3.5 text-[13px]">
          <Row label={offer.addons.length ? "Total paket + add-on" : "Total"}>{rupiah(total)}</Row>
          <Row label={dpLabel(offer)}>{dp > 0 ? rupiah(dp) : "Tidak ada DP"}</Row>
        </dl>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dp > 0 && (
            <Field label="Jatuh tempo DP">
              <DateField name="dpDue" defaultValue={defaults.dpDue} />
            </Field>
          )}
          {total - dp > 0 && (
            <Field label="Jatuh tempo pelunasan" hint="Bawaan H-14 sebelum akad.">
              <DateField name="settleDue" defaultValue={defaults.settleDue} />
            </Field>
          )}
        </div>
        {state && !state.ok && (
          <Alert variant="warn">
<AlertDescription>{state.error}</AlertDescription>
</Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ground" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan pilihan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
