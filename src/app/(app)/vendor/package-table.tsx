"use client";

import { useState, type ReactNode } from "react";
import { Check, Minus, Paperclip } from "lucide-react";
import type { Offer, Prospect } from "@/db/schema";
import { addonsTotal, compareItems, dpText, dpValue, effectiveDp, itemKey, offerTotal } from "@/lib/offer";
import { rupiah, rupiahShort } from "@/lib/format";
import { Status, cx } from "@/components/kit";

export type PackageColumn = { pkg: Offer; vendor: Prospect };

/**
 * Paket berdampingan: kolom = paket, baris = harga, pembayaran, isi, dan add-on. Dipakai di kartu
 * calon vendor (semua paketnya) dan di dialog perbandingan antar vendor. Isi yang sama di semua paket
 * dilipat jadi satu baris supaya bedanya langsung terlihat.
 */
export function PackageTable({
  columns,
  allocation,
  showVendor,
  fileNames,
  tone = "sunken",
  selected,
  onToggleSelect,
  columnActions,
  footer,
}: {
  columns: PackageColumn[];
  // Alokasi kategori untuk baris selisih; null bila anggota tidak boleh melihat Budget.
  allocation: number | null;
  // Tampilkan nama vendor, kontak, dan ketersediaan per kolom (perbandingan antar vendor).
  showVendor: boolean;
  fileNames: Record<string, string>;
  // Warna latar kartu tempat tabel berada, supaya kolom label yang menempel menutupi isi di bawahnya.
  tone?: "sunken" | "surface";
  selected?: string[];
  onToggleSelect?: (id: string) => void;
  columnActions?: (c: PackageColumn) => ReactNode;
  footer?: (c: PackageColumn) => ReactNode;
}) {
  const [showSame, setShowSame] = useState(false);
  const many = columns.length > 1;
  const totals = columns.map((c) => offerTotal(c.pkg));
  const min = many ? Math.min(...totals) : null;
  const items = compareItems(columns.map((c) => c.pkg));
  const same = many ? items.filter((r) => r.same) : [];
  const shownItems = many && !showSame ? items.filter((r) => !r.same) : items;
  const addons = addonRows(columns);
  const bg = tone === "sunken" ? "bg-sunken" : "bg-surface";
  // Kolom label menempel di kiri saat tabel digeser ke samping (paket banyak atau layar sempit).
  const th = cx("sticky left-0 z-[1] w-[132px] min-w-[132px] py-2 pr-3 text-left align-top text-[12px] font-semibold text-muted", bg);
  const td = "min-w-[168px] px-3 py-2 align-top";

  const row = (label: ReactNode, cell: (c: PackageColumn, i: number) => ReactNode, cls?: string) => (
    <tr className={cls}>
      <th scope="row" className={th}>
        {label}
      </th>
      {columns.map((c, i) => (
        <td key={c.pkg.id} className={td}>
          {cell(c, i)}
        </td>
      ))}
    </tr>
  );
  const section = (title: string) => (
    <tr>
      <th scope="colgroup" colSpan={columns.length + 1} className={cx("sticky left-0 pb-1 pt-4 text-left text-[12px] font-bold", bg)}>
        {title}
      </th>
    </tr>
  );

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th scope="col" className={cx(th, "align-bottom")}>
              <span className="sr-only">Keterangan</span>
            </th>
            {columns.map((c, i) => {
              const chosen = c.pkg.status === "dipilih";
              const checked = selected?.includes(c.pkg.id) ?? false;
              return (
                <th key={c.pkg.id} scope="col" className={cx(td, "border-b border-line pb-3 text-left font-normal")}>
                  <div className="flex flex-col gap-1">
                    {showVendor && <span className="truncate text-[12px] font-semibold text-muted">{c.vendor.name}</span>}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] font-bold leading-snug">{c.pkg.packageName || "Paket"}</span>
                      {onToggleSelect && (
                        <label className="hit-44 -mr-1 flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-muted">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleSelect(c.pkg.id)}
                            className="size-4 accent-[#1C1B29]"
                            aria-label={`Bandingkan ${c.vendor.name} ${c.pkg.packageName ?? ""}`.trim()}
                          />
                          Bandingkan
                        </label>
                      )}
                    </div>
                    <span className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em] tabular">{rupiahShort(totals[i])}</span>
                    {(chosen || totals[i] === min) && (
                      <span className="flex flex-wrap gap-1">
                        {chosen && <Status tone="info">Dipesan</Status>}
                        {totals[i] === min && <Status tone="ok">Termurah</Status>}
                      </span>
                    )}
                    {columnActions?.(c)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {section("Harga")}
          {row("Harga paket", (c) => <span className="tabular">{rupiah(c.pkg.price)}</span>)}
          {row("Add-on", (c) => (c.pkg.addons.length ? <span className="tabular">{rupiah(addonsTotal(c.pkg.addons))}</span> : <Dash />))}
          {row("Total", (c, i) => <span className="font-extrabold tabular">{rupiah(totals[i])}</span>)}
          {allocation !== null &&
            allocation > 0 &&
            row("Selisih alokasi", (_, i) => {
              const d = totals[i] - allocation;
              return (
                <span className={cx("font-bold", d < 0 ? "text-ok-fg" : d > 0 ? "text-warn-fg" : "text-muted")}>
                  {d < 0 ? `${rupiahShort(-d)} di bawah` : d > 0 ? `${rupiahShort(d)} di atas` : "Pas"}
                </span>
              );
            })}

          {section("Pembayaran")}
          {row("DP", (c) => (
            <>
              {dpText(effectiveDp(c.pkg, c.vendor))}
              {c.pkg.dpCustom && <span className="block text-[11px] font-semibold text-muted">Khusus paket ini</span>}
            </>
          ))}
          {row("Pelunasan", (c, i) => <span className="tabular">{rupiah(Math.max(0, totals[i] - dpValue(effectiveDp(c.pkg, c.vendor))))}</span>)}
          {showVendor && (
            <>
              {row("Ketersediaan", (c) => (
                <span className={c.vendor.available ? "" : "text-warn-fg"}>{c.vendor.availability || (c.vendor.available ? "Tersedia" : "Belum dikonfirmasi")}</span>
              ))}
              {row("Kontak", (c) => c.vendor.contact || <Dash />)}
            </>
          )}

          {items.length > 0 && section("Isi paket")}
          {shownItems.map((r) => (
            <tr key={r.key} className={many && !r.same ? "bg-ground" : undefined}>
              <th scope="row" className={cx(th, "font-semibold text-ink", many && !r.same && "bg-ground")}>
                {r.label}
              </th>
              {columns.map((c, i) => (
                <td key={c.pkg.id} className={td}>
                  {r.has[i] ? <Check size={16} className="text-ok-fg" aria-label="Termasuk" /> : <Dash label="Tidak termasuk" />}
                </td>
              ))}
            </tr>
          ))}
          {same.length > 0 && (
            <tr>
              <td colSpan={columns.length + 1} className={cx("sticky left-0 py-1.5", bg)}>
                <button
                  type="button"
                  aria-expanded={showSame}
                  onClick={() => setShowSame((v) => !v)}
                  className="hit-44 rounded-lg px-1 text-[12px] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                >
                  {showSame ? "Sembunyikan isi yang sama" : `${same.length} isi sama di semua paket, tampilkan`}
                </button>
              </td>
            </tr>
          )}
          {many && items.length > 0 && shownItems.length === 0 && !showSame && (
            <tr>
              <td colSpan={columns.length + 1} className={cx("sticky left-0 py-1 text-[12px] text-muted", bg)}>
                Isi paketnya sama persis; bedanya hanya di harga dan add-on.
              </td>
            </tr>
          )}

          {addons.length > 0 && section("Add-on di luar paket")}
          {addons.map((a) => (
            <tr key={a.key}>
              <th scope="row" className={cx(th, "font-semibold text-ink")}>
                {a.label}
              </th>
              {a.cells.map((cell, i) => (
                <td key={columns[i].pkg.id} className={td}>
                  {cell ? (
                    <span className="tabular">
                      {cell.qty > 1 ? `${cell.qty} x ` : ""}
                      {rupiahShort(cell.price)}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
              ))}
            </tr>
          ))}

          {columns.some((c) => c.pkg.notes || c.pkg.attachmentFileId) && section("Lainnya")}
          {columns.some((c) => c.pkg.notes) && row("Catatan", (c) => c.pkg.notes || <Dash />)}
          {columns.some((c) => c.pkg.attachmentFileId) &&
            row("Brosur", (c) =>
              c.pkg.attachmentFileId ? (
                <a href={`/api/files/${c.pkg.attachmentFileId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  <Paperclip size={13} aria-hidden="true" />
                  {fileNames[c.pkg.attachmentFileId] ?? "Buka"}
                </a>
              ) : (
                <Dash />
              ),
            )}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td className={cx("sticky left-0", bg)} />
              {columns.map((c) => (
                <td key={c.pkg.id} className={cx(td, "pt-3")}>
                  {footer(c)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Dash({ label = "Tidak ada" }: { label?: string }) {
  return <Minus size={16} className="text-[#8d8c9e]" aria-label={label} />;
}

/** Add-on per baris (dicocokkan dengan nama yang dinormalkan), dengan jumlah dan harga per paket. */
function addonRows(columns: PackageColumn[]) {
  const rows: { key: string; label: string; cells: ({ qty: number; price: number } | null)[] }[] = [];
  columns.forEach((c, i) => {
    for (const a of c.pkg.addons) {
      const key = itemKey(a.label);
      let r = rows.find((x) => x.key === key);
      if (!r) rows.push((r = { key, label: a.label, cells: columns.map(() => null) }));
      r.cells[i] = { qty: a.qty, price: a.qty * a.price };
    }
  });
  return rows;
}
