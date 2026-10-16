"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { deleteItem, updateItem } from "@/actions/seserahan";
import { ActionButton, Feedback, Modal, submitWith, type ActionResult } from "@/components/forms";
import { SelectField } from "@/components/select-field";
import { CreatableSelect } from "@/components/creatable-select";
import { Button, Field, Input, Status } from "@/components/kit";
import { hostOf, rupiah, rupiahShort } from "@/lib/format";
import type { SeserahanItem } from "@/db/schema";

const STATUS: Record<string, { label: string; tone: "warn" | "info" | "ok" }> = {
  belum: { label: "Belum", tone: "warn" },
  dipesan: { label: "Dipesan", tone: "info" },
  terbeli: { label: "Terbeli", tone: "ok" },
};

/** Nama item yang bisa diklik untuk membuka detail, lengkap dengan link pembelian. */
export function ItemDetail({ it, categories }: { it: SeserahanItem; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const close = () => {
    setOpen(false);
    setEditing(false);
  };
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await updateItem(it.id, fd);
    if (r.ok) setEditing(false);
    return r;
  }, null);
  const meta = [it.price > 0 ? rupiahShort(it.price) : null, it.pic ? `PIC ${it.pic}` : null].filter(Boolean).join(", ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="min-w-0 flex-1 rounded-[10px] py-1 text-left transition-colors duration-150 hover:bg-sunken"
      >
        <span className="block text-[14px] font-semibold">{it.name}</span>
        {(meta || it.purchaseUrl) && (
          <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            {meta && <span>{meta}</span>}
            {it.purchaseUrl && (
              <span className="inline-flex items-center gap-1">
                <Link2 size={12} aria-hidden="true" />
                {hostOf(it.purchaseUrl)}
              </span>
            )}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={editing ? `Ubah ${it.name}` : it.name}
        description={editing ? undefined : `Seserahan, kategori ${it.category}`}
      >
        {editing ? (
          <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
            <ItemFields categories={categories} it={it} />
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
              <Row label="Status">
                <Status tone={STATUS[it.status]?.tone ?? "warn"}>{STATUS[it.status]?.label ?? it.status}</Status>
              </Row>
              <Row label="Harga">{it.price > 0 ? rupiah(it.price) : "Belum diisi"}</Row>
              <Row label="PIC">{it.pic || "Belum diisi"}</Row>
              <Row label="Link pembelian">{it.purchaseUrl ? hostOf(it.purchaseUrl) : "Belum ada"}</Row>
              {it.note && (
                <div className="col-span-2">
                  <dt className="text-[11px] font-semibold text-muted">Catatan</dt>
                  <dd className="whitespace-pre-line font-semibold">{it.note}</dd>
                </div>
              )}
            </dl>
            {it.purchaseUrl ? (
              <a
                href={it.purchaseUrl}
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
                confirm={`Hapus ${it.name}?`}
                action={async () => {
                  const r = await deleteItem(it.id);
                  if (r.ok) close();
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
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  );
}

export function ItemFields({ categories, it }: { categories: string[]; it?: SeserahanItem }) {
  return (
    <>
      <Field label="Nama item">
        <Input name="name" required defaultValue={it?.name} placeholder="Contoh: Kain batik" />
      </Field>
      <Field label="Kategori" hint="Pilih kategori yang ada, atau ketik untuk menambah kategori baru.">
        <CreatableSelect
          name="category"
          options={categories}
          defaultValue={it?.category ?? categories[0] ?? ""}
          placeholder="Pilih kategori"
          searchPlaceholder="Cari atau ketik kategori baru"
          createLabel="Tambah kategori"
          emptyText="Belum ada kategori. Ketik nama kategori baru."
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status">
          <SelectField
            name="status"
            defaultValue={it?.status ?? "belum"}
            options={[
              { value: "belum", label: "Belum" },
              { value: "dipesan", label: "Dipesan" },
              { value: "terbeli", label: "Terbeli" },
            ]}
          />
        </Field>
        <Field label="Harga">
          <Input name="price" inputMode="numeric" defaultValue={it?.price ? String(it.price) : ""} />
        </Field>
      </div>
      <Field label="Link pembelian (opsional)" hint="Tempel link toko online, misalnya Tokopedia atau Shopee.">
        <Input name="purchaseUrl" inputMode="url" autoComplete="url" defaultValue={it?.purchaseUrl ?? ""} placeholder="https://" />
      </Field>
      <Field label="PIC">
        <Input name="pic" defaultValue={it?.pic ?? ""} placeholder="Contoh: Ibu Raka" />
      </Field>
      <Field label="Catatan">
        <Input name="note" defaultValue={it?.note ?? ""} placeholder="Contoh: ukuran M, warna sage" />
      </Field>
    </>
  );
}
