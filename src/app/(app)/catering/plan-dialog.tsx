"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addPlan, updatePlan } from "@/actions/catering";
import { Feedback, Modal, type ActionResult, submitWith } from "@/components/forms";
import { Button, Field, Input, Textarea, buttonClass, cx } from "@/components/kit";
import { computeCatering } from "@/lib/catering";
import { number, parseRupiah, rupiah } from "@/lib/format";
import type { CateringPlan } from "@/db/schema";

type Extra = { label: string; qty: string; price: string };

const PRESET_EXTRAS: Record<string, Extra[]> = {
  per_pax: [
    { label: "Gubukan", qty: "0", price: "" },
    { label: "Ongkos kirim dan alat saji", qty: "1", price: "" },
  ],
  masak_sendiri: [
    { label: "Sewa piring, gelas, prasmanan", qty: "1", price: "" },
    { label: "Pramusaji", qty: "0", price: "" },
  ],
};

export function PlanDialog({
  plan,
  guestPax,
  trigger,
  triggerLabel,
  variant = "primary",
}: {
  plan?: CateringPlan;
  guestPax: number;
  trigger: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "icon" | "ground";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(plan?.mode ?? "per_pax");
  const [paxSource, setPaxSource] = useState(plan?.paxSource ?? (guestPax > 0 ? "tamu" : "manual"));
  const [f, setF] = useState({
    name: plan?.name ?? "",
    manualPax: String(plan?.manualPax ?? ""),
    bufferPercent: String(plan?.bufferPercent ?? 10),
    pricePerPax: plan?.pricePerPax ? String(plan.pricePerPax) : "",
    ingredientPerPax: plan?.ingredientPerPax ? String(plan.ingredientPerPax) : "",
    cooks: String(plan?.cooks ?? 4),
    cookWage: plan?.cookWage ? String(plan.cookWage) : "",
    cookDays: String(plan?.cookDays ?? 2),
    equipmentCost: plan?.equipmentCost ? String(plan.equipmentCost) : "",
    notes: plan?.notes ?? "",
  });
  const [extras, setExtras] = useState<Extra[]>(
    plan ? plan.extras.map((e) => ({ label: e.label, qty: String(e.qty), price: String(e.price) })) : PRESET_EXTRAS.per_pax,
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const preview = computeCatering(
    {
      mode,
      paxSource,
      manualPax: Number(f.manualPax || 0),
      bufferPercent: Number(f.bufferPercent || 0),
      pricePerPax: parseRupiah(f.pricePerPax),
      ingredientPerPax: parseRupiah(f.ingredientPerPax),
      cooks: Number(f.cooks || 0),
      cookWage: parseRupiah(f.cookWage),
      cookDays: Number(f.cookDays || 0),
      equipmentCost: parseRupiah(f.equipmentCost),
      extras: extras.map((e) => ({ label: e.label, qty: Number(e.qty || 0), price: parseRupiah(e.price) })),
    },
    guestPax,
  );

  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = plan ? await updatePlan(plan.id, fd) : await addPlan(fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen(true)}
        className={
          variant === "icon"
            ? "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-ground"
            : buttonClass(variant === "ground" ? "ground" : "primary")
        }
      >
        {trigger}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={plan ? `Ubah ${plan.name}` : "Tambah skenario catering"}>
        <form onSubmit={submitWith(action)} className="grid grid-cols-1 gap-5 min-[860px]:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-4">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="paxSource" value={paxSource} />
            <Field label="Nama skenario">
              <Input name="name" required value={f.name} onChange={set("name")} placeholder="Contoh: Catering A prasmanan" />
            </Field>

            <Toggle
              label="Cara penyediaan"
              value={mode}
              onChange={(v) => {
                setMode(v);
                if (!plan && extras.every((e) => !e.price)) setExtras(PRESET_EXTRAS[v]);
              }}
              options={[
                ["per_pax", "Vendor catering per pax"],
                ["masak_sendiri", "Masak sendiri, sewa juru masak"],
              ]}
            />

            <Toggle
              label="Jumlah orang"
              value={paxSource}
              onChange={setPaxSource}
              options={[
                ["tamu", `Dari daftar tamu (${number(guestPax)} orang)`],
                ["manual", "Isi manual"],
              ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {paxSource === "manual" && (
                <Field label="Jumlah orang">
                  <Input name="manualPax" type="number" min={0} value={f.manualPax} onChange={set("manualPax")} />
                </Field>
              )}
              <Field label="Cadangan porsi (%)" hint="Untuk tamu tak terduga dan keluarga yang membantu.">
                <Input name="bufferPercent" type="number" min={0} max={100} value={f.bufferPercent} onChange={set("bufferPercent")} />
              </Field>
            </div>

            {mode === "per_pax" ? (
              <Field label="Harga per pax" hint="Boleh ditulis 55000 atau 55rb.">
                <Input name="pricePerPax" inputMode="numeric" value={f.pricePerPax} onChange={set("pricePerPax")} />
              </Field>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Biaya bahan per porsi" hint="Belanja bahan dibagi jumlah porsi.">
                  <Input name="ingredientPerPax" inputMode="numeric" value={f.ingredientPerPax} onChange={set("ingredientPerPax")} />
                </Field>
                <Field label="Jumlah juru masak">
                  <Input name="cooks" type="number" min={0} value={f.cooks} onChange={set("cooks")} />
                </Field>
                <Field label="Upah per orang per hari">
                  <Input name="cookWage" inputMode="numeric" value={f.cookWage} onChange={set("cookWage")} />
                </Field>
                <Field label="Jumlah hari kerja" hint="Termasuk hari persiapan.">
                  <Input name="cookDays" type="number" min={0} value={f.cookDays} onChange={set("cookDays")} />
                </Field>
                <Field label="Sewa alat masak dan gas" className="sm:col-span-2">
                  <Input name="equipmentCost" inputMode="numeric" value={f.equipmentCost} onChange={set("equipmentCost")} />
                </Field>
              </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[12px] font-semibold text-muted">Biaya tambahan</legend>
              {extras.map((e, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,120px)_44px] items-center gap-2">
                  <Input
                    name="extraLabel"
                    aria-label="Nama biaya"
                    value={e.label}
                    placeholder="Nama biaya"
                    onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
                  />
                  <Input
                    name="extraQty"
                    aria-label="Jumlah"
                    type="number"
                    min={0}
                    value={e.qty}
                    onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, qty: ev.target.value } : x)))}
                  />
                  <Input
                    name="extraPrice"
                    aria-label="Harga satuan"
                    inputMode="numeric"
                    value={e.price}
                    placeholder="Harga"
                    onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, price: ev.target.value } : x)))}
                  />
                  <button
                    type="button"
                    aria-label={`Hapus ${e.label || "biaya"}`}
                    onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                    className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-ground"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setExtras([...extras, { label: "", qty: "1", price: "" }])}
              >
                <Plus size={14} aria-hidden="true" />
                Tambah biaya
              </Button>
            </fieldset>

            <Field label="Catatan">
              <Textarea name="notes" value={f.notes} onChange={set("notes")} placeholder="Contoh: menu nasi, 2 lauk, sayur, buah" />
            </Field>
          </div>

          {/* Pratinjau hitungan */}
          <aside className="flex h-fit flex-col gap-3 rounded-[18px] bg-sunken p-4 min-[860px]:sticky min-[860px]:top-0" aria-live="polite">
            <div>
              <div className="text-[12px] font-semibold text-muted">Perkiraan total</div>
              <div className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{rupiah(preview.total)}</div>
              <div className="text-[12px] text-muted">
                {number(preview.portions)} porsi dari {number(preview.basePax)} orang, {rupiah(preview.perPortion)} per porsi
              </div>
            </div>
            <ul className="flex flex-col gap-2 border-t border-line pt-3 text-[12px]">
              {preview.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.label}</span>
                    {l.detail && <span className="block text-muted">{l.detail}</span>}
                  </span>
                  <span className="shrink-0 font-bold">{rupiah(l.amount)}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex flex-col gap-3 min-[860px]:col-span-2">
            {state && !state.ok && <Feedback state={state} />}
            <div className="flex justify-end gap-2">
              <Button variant="ground" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan skenario"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Toggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <div role="group" aria-label={label} className="grid grid-cols-1 gap-1 rounded-xl bg-ground p-1 sm:grid-cols-2">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cx(
              "min-h-10 rounded-[10px] px-3 py-2 text-left text-[13px] font-bold transition-colors duration-150",
              value === v ? "bg-ink text-white" : "text-ink hover:bg-surface",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
