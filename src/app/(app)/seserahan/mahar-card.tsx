"use client";

import { useActionState, useState } from "react";
import { ChevronRight, ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { addMahar, deleteMahar, updateMahar } from "@/actions/seserahan";
import { ActionButton, Feedback, FormDialog, Modal, type ActionResult, submitWith } from "@/components/forms";
import { SelectField } from "@/components/select-field";
import { Button, Field, Input, Status, Textarea, cx } from "@/components/kit";
import { hostOf, rupiah, rupiahShort } from "@/lib/format";
import type { MaharItem } from "@/db/schema";


export function MaharCard({ items }: { items: MaharItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = items.find((i) => i.id === openId) ?? null;
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <section className="on-ink flex flex-col gap-3 rounded-[22px] bg-ink p-[18px] text-white sm:p-5" aria-labelledby="mahar-title">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id="mahar-title" className="text-[12px] font-semibold text-[#c9c8d6]">
            Mahar
          </h2>
          <p className="text-[13px] text-[#d9d8e4]">Disebut saat ijab kabul</p>
        </div>
        <FormDialog
          variant="icon"
          triggerLabel="Tambah item mahar"
          triggerClassName="text-white hover:bg-white/10"
          title="Tambah item mahar"
          description="Mahar dicatat terpisah dari seserahan. Tambahkan link pembelian bila dibeli online."
          action={addMahar}
          trigger={<Plus size={18} aria-hidden="true" />}
        >
          <MaharFields />
        </FormDialog>
      </div>

      {items.length === 0 ? (
        <p className="text-[14px] text-[#d9d8e4]">Mahar belum dicatat. Tambahkan item seperti emas atau seperangkat alat salat.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(m.id)}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-3 rounded-[14px] bg-white/[0.07] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.12]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold leading-snug">{m.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#d9d8e4]">
                      {m.value > 0 && <span>{rupiahShort(m.value)}</span>}
                      <span className={m.status === "terbeli" ? "text-accent" : ""}>{m.status === "terbeli" ? "Sudah dibeli" : "Belum dibeli"}</span>
                      {m.purchaseUrl && (
                        <span className="inline-flex items-center gap-1">
                          <Link2 size={12} aria-hidden="true" />
                          {hostOf(m.purchaseUrl)}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#c9c8d6]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {total > 0 && (
            <p className="text-[13px] text-[#d9d8e4]">
              Total nilai <strong className="text-white">{rupiah(total)}</strong>
            </p>
          )}
        </>
      )}

      {opened && <MaharDetail key={opened.id} m={opened} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function MaharDetail({ m, onClose }: { m: MaharItem; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await updateMahar(m.id, fd);
    if (r.ok) setEditing(false);
    return r;
  }, null);

  return (
    <Modal open onClose={onClose} title={editing ? `Ubah ${m.name}` : m.name} description={editing ? undefined : "Detail item mahar"}>
      {editing ? (
        <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
          <MaharFields m={m} />
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
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 rounded-[18px] bg-sunken p-4 text-[13px]">
            <Row label="Nilai">{m.value > 0 ? rupiah(m.value) : "Belum diisi"}</Row>
            <Row label="Status">
              <Status tone={m.status === "terbeli" ? "ok" : "warn"}>{m.status === "terbeli" ? "Sudah dibeli" : "Belum dibeli"}</Status>
            </Row>
            <Row label="Disimpan oleh">{m.keeper || "Belum diisi"}</Row>
            <Row label="Link pembelian">{m.purchaseUrl ? hostOf(m.purchaseUrl) : "Belum ada"}</Row>
            {m.note && (
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold text-muted">Catatan</dt>
                <dd className="whitespace-pre-line font-semibold">{m.note}</dd>
              </div>
            )}
          </dl>

          {m.purchaseUrl ? (
            <a
              href={m.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-bold text-white no-underline hover:bg-[#2e2d40]"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Buka link pembelian
            </a>
          ) : (
            <p className="text-[13px] text-muted">Belum ada link pembelian. Tambahkan lewat tombol Ubah.</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ground pt-4">
            <ActionButton
              variant="danger"
              confirm={`Hapus ${m.name} dari mahar?`}
              action={async () => {
                const r = await deleteMahar(m.id);
                if (r.ok) onClose();
                return r;
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Hapus
            </ActionButton>
            <Button variant="ground" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" />
              Ubah
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className={cx("truncate font-semibold")}>{children}</dd>
    </div>
  );
}

function MaharFields({ m }: { m?: MaharItem }) {
  return (
    <>
      <Field label="Nama item">
        <Input name="name" required defaultValue={m?.name} placeholder="Contoh: Emas 10 gram" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nilai (opsional)">
          <Input name="value" inputMode="numeric" defaultValue={m?.value ? String(m.value) : ""} placeholder="Contoh: 12jt" />
        </Field>
        <Field label="Status">
          <SelectField
            name="status"
            defaultValue={m?.status ?? "belum"}
            options={[
              { value: "belum", label: "Belum dibeli" },
              { value: "terbeli", label: "Sudah dibeli" },
            ]}
          />
        </Field>
      </div>
      <Field label="Link pembelian (opsional)" hint="Tempel link toko online, misalnya Tokopedia, Shopee, atau situs toko emas.">
        <Input name="purchaseUrl" inputMode="url" autoComplete="url" defaultValue={m?.purchaseUrl ?? ""} placeholder="https://" />
      </Field>
      <Field label="Disimpan oleh">
        <Input name="keeper" defaultValue={m?.keeper ?? ""} placeholder="Contoh: Ibu Raka" />
      </Field>
      <Field label="Catatan">
        <Textarea name="note" defaultValue={m?.note ?? ""} placeholder="Contoh: kadar 24 karat, minta sertifikat" />
      </Field>
    </>
  );
}
