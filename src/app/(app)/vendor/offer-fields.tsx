"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SelectField } from "@/components/select-field";
import { FileInput } from "@/components/file-input";
import { Button, Field, Input, Textarea, cx } from "@/components/kit";
import { parseRupiah, rupiah } from "@/lib/format";
import type { Offer, OfferAddon, Vendor } from "@/db/schema";

type Cat = { id: string; name: string };
type AddonRow = { label: string; qty: string; price: string };

/* ---------- Editor paket: harga, isi paket (daftar), add-on, total ---------- */

function usePackage(init: { price?: number; items?: string[]; addons?: OfferAddon[] }) {
  const [price, setPrice] = useState(init.price ? String(init.price) : "");
  const [items, setItems] = useState<string[]>(init.items?.length ? init.items : [""]);
  const [addons, setAddons] = useState<AddonRow[]>((init.addons ?? []).map((a) => ({ label: a.label, qty: String(a.qty), price: String(a.price) })));
  const paket = parseRupiah(price);
  const addonSum = addons.reduce((s, a) => s + Number(a.qty || 0) * parseRupiah(a.price), 0);
  return { price, setPrice, items, setItems, addons, setAddons, paket, total: paket + addonSum };
}

type Pkg = ReturnType<typeof usePackage>;

function PackagePrice({ pkg }: { pkg: Pkg }) {
  return (
    <Field label="Harga paket" hint="Boleh ditulis 14000000, 14.000.000, atau 14jt.">
      <Input name="price" inputMode="numeric" required value={pkg.price} onChange={(e) => pkg.setPrice(e.target.value)} placeholder="Contoh: 14jt" />
    </Field>
  );
}

function PackageLists({ pkg }: { pkg: Pkg }) {
  const { items, setItems, addons, setAddons } = pkg;
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addItemAfter = (i: number) => {
    setItems((p) => [...p.slice(0, i + 1), "", ...p.slice(i + 1)]);
    setTimeout(() => itemRefs.current[i + 1]?.focus(), 0);
  };
  const setAddon = (i: number, k: keyof AddonRow, v: string) => setAddons((p) => p.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-semibold text-muted">Isi paket</legend>
        <ul className="flex flex-col gap-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[12px] font-semibold text-muted tabular">{i + 1}.</span>
              <Input
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                name="includeItem"
                aria-label={`Isi paket ${i + 1}`}
                value={it}
                placeholder={i === 0 ? "Contoh: Pelaminan Jawa 6 meter" : "Item berikutnya"}
                onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  // Enter menambah baris baru, bukan mengirim form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItemAfter(i);
                  }
                  if (e.key === "Backspace" && !it && items.length > 1) {
                    e.preventDefault();
                    setItems((p) => p.filter((_, j) => j !== i));
                    setTimeout(() => itemRefs.current[Math.max(0, i - 1)]?.focus(), 0);
                  }
                }}
              />
              <button
                type="button"
                aria-label={`Hapus isi paket ${i + 1}`}
                disabled={items.length === 1 && !it}
                onClick={() => setItems((p) => (p.length === 1 ? [""] : p.filter((_, j) => j !== i)))}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-ground disabled:opacity-30"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="self-start" onClick={() => addItemAfter(items.length - 1)}>
          <Plus size={14} aria-hidden="true" />
          Tambah isi paket
        </Button>
        <p className="text-[12px] text-muted">Tekan Enter untuk menambah baris baru.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-semibold text-muted">Add-on di luar paket</legend>
        {addons.length === 0 && (
          <p className="text-[13px] text-muted">Belum ada add-on. Tambahkan bila ada tambahan di luar paket, misalnya gubukan atau jam ekstra.</p>
        )}
        {addons.length > 0 && (
          <div className="hidden grid-cols-[minmax(0,1fr)_72px_minmax(0,130px)_44px] gap-2 px-0.5 text-[11px] font-semibold text-muted sm:grid">
            <span>Nama add-on</span>
            <span>Jumlah</span>
            <span>Harga satuan</span>
            <span />
          </div>
        )}
        {addons.map((a, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_44px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,130px)_44px]">
            <Input name="addonLabel" aria-label="Nama add-on" value={a.label} placeholder="Contoh: Gubukan bakso" onChange={(e) => setAddon(i, "label", e.target.value)} />
            <Input name="addonQty" aria-label="Jumlah" type="number" min={1} value={a.qty} onChange={(e) => setAddon(i, "qty", e.target.value)} />
            <Input
              name="addonPrice"
              aria-label="Harga satuan"
              inputMode="numeric"
              value={a.price}
              placeholder="Harga"
              onChange={(e) => setAddon(i, "price", e.target.value)}
              className="max-sm:col-span-2 max-sm:row-start-2"
            />
            <button
              type="button"
              aria-label={`Hapus add-on ${a.label || i + 1}`}
              onClick={() => setAddons((p) => p.filter((_, j) => j !== i))}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-ground max-sm:col-start-3 max-sm:row-start-1"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAddons((p) => [...p, { label: "", qty: "1", price: "" }])}>
          <Plus size={14} aria-hidden="true" />
          Tambah add-on
        </Button>
      </fieldset>
    </>
  );
}

function TotalSummary({ pkg, extra }: { pkg: Pkg; extra?: React.ReactNode }) {
  return (
    <dl className="flex flex-col gap-1.5 rounded-[18px] bg-sunken p-4 text-[13px]" aria-live="polite">
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Harga paket</dt>
        <dd className="font-semibold tabular">{rupiah(pkg.paket)}</dd>
      </div>
      {pkg.addons
        .filter((a) => a.label || a.price)
        .map((a, i) => (
          <div key={i} className="flex justify-between gap-3">
            <dt className="min-w-0 truncate text-muted">
              {a.label || "Add-on"}
              {Number(a.qty) > 1 ? ` x${a.qty}` : ""}
            </dt>
            <dd className="font-semibold tabular">{rupiah(Number(a.qty || 0) * parseRupiah(a.price))}</dd>
          </div>
        ))}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <dt className="font-bold">Total</dt>
        <dd className="text-[20px] font-extrabold tracking-[-0.01em] tabular">{rupiah(pkg.total)}</dd>
      </div>
      {extra}
    </dl>
  );
}

/* ---------- DP: persen, nominal, atau tanpa DP ---------- */

function DpEditor({ total, o }: { total: number; o?: Offer }) {
  const [type, setType] = useState(o?.dpType ?? "percent");
  const [pct, setPct] = useState(String(o?.dpPercent ?? 30));
  const [amount, setAmount] = useState(o?.dpAmount ? String(o.dpAmount) : "");
  const dp = type === "none" ? 0 : type === "nominal" ? Math.min(parseRupiah(amount), total) : Math.round((total * Number(pct || 0)) / 100);

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="dpType" value={type} />
      <span className="text-[12px] font-semibold text-muted">DP saat booking</span>
      <div role="group" aria-label="Cara DP" className="grid grid-cols-3 gap-1 rounded-xl bg-ground p-1">
        {(
          [
            ["percent", "Persen"],
            ["nominal", "Nominal"],
            ["none", "Tanpa DP"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={type === v}
            onClick={() => setType(v)}
            className={cx(
              "h-10 rounded-[10px] text-[13px] font-bold transition-colors duration-150",
              type === v ? "bg-ink text-white" : "text-ink hover:bg-surface",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {type === "percent" && (
        <Field label="Persen DP dari total">
          <Input name="dpPercent" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
        </Field>
      )}
      {type === "nominal" && (
        <Field label="Nominal DP" hint="Misalnya vendor meminta DP Rp 2 jt, berapa pun total paketnya.">
          <Input name="dpAmount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Contoh: 2jt" />
        </Field>
      )}
      <p className="text-[12px] text-muted">
        {type === "none"
          ? "Tidak ada DP. Saat penawaran dipilih, seluruh total dijadwalkan sebagai pelunasan."
          : `DP ${rupiah(dp)}, sisa pelunasan ${rupiah(Math.max(0, total - dp))}.`}
      </p>
    </div>
  );
}

/* ---------- Form penawaran ---------- */

export function OfferFields({ cats, categoryId, o, fileName }: { cats: Cat[]; categoryId: string; o?: Offer; fileName?: string }) {
  const pkg = usePackage({ price: o?.price, items: o?.includeItems, addons: o?.addons });
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama vendor">
          <Input name="vendorName" required defaultValue={o?.vendorName} placeholder="Contoh: Vendor A" />
        </Field>
        <Field label="Nama paket">
          <Input name="packageName" defaultValue={o?.packageName ?? ""} placeholder="Contoh: Paket prasmanan 800 porsi" />
        </Field>
        <Field label="Kategori">
          <SelectField name="categoryId" defaultValue={categoryId} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <PackagePrice pkg={pkg} />
      </div>
      <PackageLists pkg={pkg} />
      <TotalSummary pkg={pkg} />
      <DpEditor total={pkg.total} o={o} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ketersediaan tanggal">
          <SelectField
            name="available"
            defaultValue={o && !o.available ? "belum" : "ya"}
            options={[
              { value: "ya", label: "Tersedia" },
              { value: "belum", label: "Belum dikonfirmasi" },
            ]}
          />
        </Field>
        <Field label="Keterangan ketersediaan">
          <Input name="availability" defaultValue={o?.availability ?? ""} placeholder="Contoh: Tersedia 13 dan 14 Feb" />
        </Field>
        <Field label="Catatan">
          <Input name="notes" defaultValue={o?.notes ?? ""} placeholder="Contoh: Rekomendasi keluarga" />
        </Field>
        <Field label="Kontak">
          <Input name="contact" defaultValue={o?.contact ?? ""} placeholder="No. WhatsApp" />
        </Field>
      </div>
      <FileInput
        name="attachmentFileId"
        kind="offer"
        label="Lampiran penawaran (opsional)"
        current={o?.attachmentFileId ? { id: o.attachmentFileId, name: fileName ?? "Lampiran" } : null}
      />
    </>
  );
}

/* ---------- Form vendor terpesan ---------- */

export function VendorFields({ cats, v }: { cats: Cat[]; v?: Vendor }) {
  const pkg = usePackage({ price: v?.packagePrice, items: v?.includeItems, addons: v?.addons });
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama vendor">
          <Input name="name" required defaultValue={v?.name} />
        </Field>
        <Field label="Kategori">
          <SelectField
            name="categoryId"
            defaultValue={v?.categoryId ?? ""}
            options={[{ value: "", label: "Tanpa kategori" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Field label="Nama paket">
          <Input name="packageName" defaultValue={v?.packageName ?? ""} placeholder="Contoh: Paket lengkap" />
        </Field>
        <PackagePrice pkg={pkg} />
      </div>
      <PackageLists pkg={pkg} />
      <TotalSummary pkg={pkg} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Kontak">
          <Input name="contact" defaultValue={v?.contact ?? ""} placeholder="No. WhatsApp" />
        </Field>
      </div>
      <Field label="Catatan">
        <Textarea name="packageDesc" defaultValue={v?.packageDesc ?? ""} placeholder="Contoh: rias dimulai 05.00, minta 2 asisten" />
      </Field>
    </>
  );
}
