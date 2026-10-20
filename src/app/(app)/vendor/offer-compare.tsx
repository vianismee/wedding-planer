"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { addPackage, addProspect, cancelOffer, chooseOffer, deletePackage, deleteProspect, duplicatePackage, trackCompare, updatePackage, updateProspect } from "@/actions/vendor";
import { ActionButton, FormDialog, Modal, type ActionResult, submitWith } from "@/components/forms";
import { Button, Field, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { rupiah, rupiahShort } from "@/lib/format";
import type { Offer, Prospect } from "@/db/schema";
import { dpLabel, dpValue, effectiveDp, offerTotal } from "@/lib/offer";
import { NewProspectFields, PackageFields, ProspectFields } from "./offer-fields";
import { PackageTable, type PackageColumn } from "./package-table";

type Cat = { id: string; name: string; allocation: number; need: string | null };
export type VendorGroup = { vendor: Prospect; packages: Offer[] };

const MAX_COMPARE = 4;
const packageName = (c: PackageColumn) => `${c.vendor.name}${c.pkg.packageName ? `, ${c.pkg.packageName}` : ""}`;

/** "DP 30%", "DP Rp 2 jt", atau "Tanpa DP": DP bawaan calon vendor, sebelum dihitung dari total paket. */
function dpShort(v: Prospect) {
  if (v.dpType === "none") return "Tanpa DP";
  return v.dpType === "nominal" ? `DP ${rupiahShort(v.dpAmount)}` : `DP ${v.dpPercent}%`;
}

/**
 * Perbandingan calon vendor per kategori. Setiap calon vendor tampil sebagai satu kartu berisi tabel
 * paketnya berdampingan; paket dari beberapa vendor bisa dicentang lalu dibandingkan dalam satu tabel.
 */
export function OfferCompare({
  cats,
  groups,
  bookedCats,
  initialCat,
  fileNames,
  defaults,
  canEdit,
  seeBudget,
}: {
  canEdit: boolean;
  seeBudget: boolean;
  cats: Cat[];
  groups: VendorGroup[];
  bookedCats: string[];
  initialCat?: string;
  fileNames: Record<string, string>;
  defaults: { dpDue: string; settleDue: string };
}) {
  // Kategori dengan calon vendor tampil lebih dulu.
  const tabs = useMemo(() => {
    const inCat = (id: string) => groups.filter((g) => g.vendor.categoryId === id);
    return [...cats]
      .map((c) => ({ ...c, vendors: inCat(c.id).length, packages: inCat(c.id).reduce((s, g) => s + g.packages.length, 0) }))
      .sort((a, b) => Number(b.vendors > 0) - Number(a.vendors > 0));
  }, [cats, groups]);
  const [catId, setCatId] = useState<string | undefined>((initialCat && cats.some((c) => c.id === initialCat) ? initialCat : undefined) ?? tabs[0]?.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [picking, setPicking] = useState<PackageColumn | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const cat = cats.find((c) => c.id === catId);
  const list = groups.filter((g) => g.vendor.categoryId === catId);
  const columns = list.flatMap((g) => g.packages.map((pkg) => ({ pkg, vendor: g.vendor })));
  const chosen = columns.find((c) => c.pkg.status === "dipilih");
  const booked = catId ? bookedCats.includes(catId) : false;
  const allocation = seeBudget && cat ? cat.allocation : null;
  const compareColumns = selected.map((id) => columns.find((c) => c.pkg.id === id)).filter((c): c is PackageColumn => !!c);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]));
  const openCompare = (ids?: string[]) => {
    if (ids) setSelected(ids.slice(0, MAX_COMPARE));
    setComparing(true);
    if (catId) trackCompare(catId).catch(() => {});
  };
  const catOpts = cats.map((c) => ({ id: c.id, name: c.name }));

  if (cats.length === 0)
    return (
      <section className="rounded-[24px] bg-surface p-5">
        <h2 className="text-[18px] font-bold">Bandingkan penawaran</h2>
        <p className="mt-1 text-[13px] text-muted">Belum ada kategori budget. Tambahkan kategori di halaman Budget, lalu bandingkan penawaran per kategori di sini.</p>
      </section>
    );

  /** Tombol di kaki kolom paket: pilih, atau batalkan pesanan bila paket itu sudah dipesan. */
  const pickButton = (c: PackageColumn) =>
    !canEdit ? null : c.pkg.status === "dipilih" ? (
      <ActionButton
        variant="outline"
        className="w-full"
        confirm={`Batalkan pesanan ${packageName(c)}? Vendor dan termin DP serta pelunasannya dihapus, paketnya tetap ada. Pengeluaran yang sudah dibayar tetap tercatat di Budget.`}
        confirmLabel="Batalkan pesanan"
        action={cancelOffer.bind(null, c.pkg.id)}
      >
        Batalkan pesanan
      </ActionButton>
    ) : (
      <Button
        className="w-full"
        onClick={() => {
          setComparing(false);
          setSaved(null);
          setPicking(c);
        }}
      >
        {booked ? "Pesan juga" : "Pilih paket ini"}
      </Button>
    );

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
              {cat.need ? `: ${cat.need}` : ""}.{allocation !== null && ` Alokasi budget ${rupiahShort(allocation)}.`}
            </p>
          )}
        </div>
        {cat && canEdit && (
          <FormDialog
            wide
            title={`Tambah calon vendor ${cat.name}`}
            description="Info vendor diisi sekali. Paket lain dari vendor yang sama ditambahkan di kartunya."
            action={addProspect}
            trigger={
              <>
                <Plus size={16} aria-hidden="true" />
                Tambah vendor
              </>
            }
          >
            <NewProspectFields cats={catOpts} categoryId={cat.id} />
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
              setSelected([]);
              setSaved(null);
            }}
            className={cx(
              "flex h-12 shrink-0 flex-col items-start justify-center rounded-[10px] px-3.5 text-left transition-colors duration-150",
              t.id === catId ? "bg-ink text-white" : "text-ink hover:bg-surface",
            )}
          >
            <span className="text-[13px] font-bold leading-tight">{t.name}</span>
            <span className={cx("text-[11px] font-semibold leading-tight", t.id === catId ? "text-[#c9c8d6]" : "text-muted")}>
              {t.vendors ? `${t.vendors} vendor, ${t.packages} paket` : "Belum ada"}
            </span>
          </button>
        ))}
      </div>

      {saved && (
        <Alert variant="ok">
          <AlertDescription>
            {saved}{" "}
            <a href="/budget" className="underline">
              Lihat termin di Budget
            </a>
          </AlertDescription>
        </Alert>
      )}

      {list.length === 0 ? (
        <div className="rounded-[18px] bg-sunken p-5">
          <p className="text-[14px] font-bold">Belum ada calon vendor untuk {cat?.name}.</p>
          <p className="text-[13px] text-muted">
            {canEdit ? "Tambahkan vendor pertama beserta paketnya. Vendor dengan beberapa paket cukup dicatat sekali." : "Calon vendor akan muncul di sini setelah ditambahkan."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((g) => (
            <VendorCard
              key={g.vendor.id}
              group={g}
              catOpts={catOpts}
              templates={columns.map((c) => ({ label: packageName(c), offer: c.pkg }))}
              allocation={allocation}
              fileNames={fileNames}
              canEdit={canEdit}
              selected={selected}
              onToggleSelect={toggle}
              onCompareAll={() => openCompare(g.packages.map((p) => p.id))}
              footer={pickButton}
            />
          ))}
        </div>
      )}

      {/* Bar bawah: paket yang dicentang untuk dibandingkan, atau ringkasan pilihan kategori ini. */}
      {(selected.length > 0 || chosen) && (
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-ground p-3.5",
            selected.length > 0 && "rise max-[899px]:fixed max-[899px]:inset-x-3 max-[899px]:z-20 max-[899px]:bg-surface max-[899px]:shadow-bar",
          )}
          style={selected.length > 0 ? { bottom: "calc(96px + env(safe-area-inset-bottom))" } : undefined}
        >
          <p className="min-w-0 flex-1 text-[13px] font-semibold">
            {selected.length > 0
              ? `${selected.length} paket dipilih untuk dibandingkan${selected.length >= MAX_COMPARE ? `, maksimal ${MAX_COMPARE}` : ""}.`
              : `${packageName(chosen!)} sudah dipesan untuk ${cat?.name}.`}
          </p>
          {selected.length > 0 && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected([])}>
                Kosongkan
              </Button>
              <Button disabled={selected.length < 2} onClick={() => openCompare()}>
                Bandingkan
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={comparing && compareColumns.length > 0} onClose={() => setComparing(false)} wide title={`Bandingkan ${compareColumns.length} paket ${cat?.name ?? ""}`.trim()}>
        <div className="max-h-[70dvh] overflow-y-auto">
          <PackageTable columns={compareColumns} allocation={allocation} showVendor fileNames={fileNames} tone="surface" footer={pickButton} />
        </div>
      </Modal>

      {picking && (
        <SaveDialog
          column={picking}
          defaults={defaults}
          onClose={() => setPicking(null)}
          onSaved={(msg) => {
            setPicking(null);
            setSelected([]);
            setSaved(msg);
          }}
        />
      )}
    </section>
  );
}

/** Satu calon vendor: info bersama, lalu tabel semua paketnya berdampingan. */
function VendorCard({
  group: { vendor: v, packages },
  catOpts,
  templates,
  allocation,
  fileNames,
  canEdit,
  selected,
  onToggleSelect,
  onCompareAll,
  footer,
}: {
  group: VendorGroup;
  catOpts: { id: string; name: string }[];
  templates: { label: string; offer: Offer }[];
  allocation: number | null;
  fileNames: Record<string, string>;
  canEdit: boolean;
  selected: string[];
  onToggleSelect: (id: string) => void;
  onCompareAll: () => void;
  footer: (c: PackageColumn) => React.ReactNode;
}) {
  const columns = packages.map((pkg) => ({ pkg, vendor: v }));
  const cheapest = Math.min(...packages.map(offerTotal));
  return (
    <article className="flex flex-col gap-3 rounded-[18px] bg-sunken p-4" aria-labelledby={`pv-${v.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`pv-${v.id}`} className="text-[16px] font-bold">
            {v.name}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <span>{packages.length} paket</span>
            <span>{dpShort(v)}</span>
            <span className={v.available ? "" : "font-semibold text-warn-fg"}>{v.availability || (v.available ? "Tersedia" : "Belum dikonfirmasi")}</span>
            {v.contact && <span>{v.contact}</span>}
          </div>
          {v.notes && <p className="text-[12px] text-muted">{v.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {packages.length > 1 && (
            <Button variant="ghost" size="sm" onClick={onCompareAll}>
              Bandingkan semua paket
            </Button>
          )}
          {canEdit && (
            <>
              <FormDialog
                variant="ground"
                size="sm"
                wide
                title={`Tambah paket ${v.name}`}
                description="DP mengikuti vendor, kecuali diatur khusus untuk paket ini."
                action={addPackage.bind(null, v.id)}
                trigger={
                  <>
                    <Plus size={14} aria-hidden="true" />
                    Paket
                  </>
                }
              >
                <PackageFields vendor={v} templates={templates} />
              </FormDialog>
              <FormDialog
                variant="icon"
                triggerLabel={`Ubah info ${v.name}`}
                wide
                title={`Ubah info ${v.name}`}
                description="Berlaku untuk semua paket vendor ini."
                action={updateProspect.bind(null, v.id)}
                trigger={<Pencil size={15} aria-hidden="true" />}
                footer={
                  <ActionButton
                    variant="danger"
                    className="mr-auto"
                    confirm={`Hapus ${v.name} beserta ${packages.length} paketnya? Vendor yang sudah dipesan tetap ada.`}
                    action={deleteProspect.bind(null, v.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Hapus vendor
                  </ActionButton>
                }
              >
                <ProspectFields cats={catOpts} p={v} total={cheapest} />
              </FormDialog>
            </>
          )}
        </div>
      </div>
      <PackageTable
        columns={columns}
        allocation={allocation}
        showVendor={false}
        fileNames={fileNames}
        selected={selected}
        onToggleSelect={onToggleSelect}
        columnActions={canEdit ? (c) => <PackageActions c={c} templates={templates} fileNames={fileNames} last={packages.length === 1} /> : undefined}
        footer={footer}
      />
    </article>
  );
}

/** Ubah, salin, dan hapus satu paket, di kepala kolomnya. */
function PackageActions({ c, templates, fileNames, last }: { c: PackageColumn; templates: { label: string; offer: Offer }[]; fileNames: Record<string, string>; last: boolean }) {
  const name = c.pkg.packageName || "paket ini";
  return (
    <span className="-ml-2.5 flex">
      <FormDialog
        variant="icon"
        triggerLabel={`Ubah ${name}`}
        wide
        title={`Ubah ${name}`}
        action={updatePackage.bind(null, c.pkg.id)}
        trigger={<Pencil size={14} aria-hidden="true" />}
      >
        <PackageFields vendor={c.vendor} o={c.pkg} templates={templates} fileName={c.pkg.attachmentFileId ? fileNames[c.pkg.attachmentFileId] : undefined} />
      </FormDialog>
      <ActionButton variant="icon" label={`Salin ${name}`} action={duplicatePackage.bind(null, c.pkg.id)}>
        <Copy size={14} aria-hidden="true" />
      </ActionButton>
      <ActionButton
        variant="icon"
        label={`Hapus ${name}`}
        confirm={last ? `Hapus ${name}? Ini paket terakhir, jadi ${c.vendor.name} ikut terhapus dari perbandingan.` : `Hapus ${name}?`}
        action={deletePackage.bind(null, c.pkg.id)}
      >
        {last ? <X size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
      </ActionButton>
    </span>
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

function SaveDialog({
  column: { pkg, vendor },
  defaults,
  onClose,
  onSaved,
}: {
  column: PackageColumn;
  defaults: { dpDue: string; settleDue: string };
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const total = offerTotal(pkg);
  const dpInput = effectiveDp(pkg, vendor);
  const dp = dpValue(dpInput);
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await chooseOffer(pkg.id, fd);
    if (r.ok) onSaved(r.message ?? "Tersimpan.");
    return r;
  }, null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pesan ${vendor.name}${pkg.packageName ? `, ${pkg.packageName}` : ""}`}
      description="Paket ini menjadi vendor terpesan dan termin pembayarannya masuk ke Budget."
    >
      <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 rounded-[14px] bg-sunken p-3.5 text-[13px]">
          <Row label={pkg.addons.length ? "Total paket + add-on" : "Total"}>{rupiah(total)}</Row>
          <Row label={dpLabel(dpInput)}>{dp > 0 ? rupiah(dp) : "Tidak ada DP"}</Row>
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
