"use client";

import type { ReactNode } from "react";
import { Check, Paperclip, Plus } from "lucide-react";
import type { Offer, Prospect } from "@/db/schema";
import { compareItems, dpText, dpValue, effectiveDp, itemKey, offerTotal } from "@/lib/offer";
import { rupiah, rupiahShort } from "@/lib/format";
import { Status, cx } from "@/components/kit";

export type PackageColumn = { pkg: Offer; vendor: Prospect };

/**
 * Beda isi tiap paket terhadap paket lain dalam daftar yang sama: isi yang tidak dimiliki semua paket
 * (`extra`) dan isi paket lain yang tidak termasuk di paket ini (`missing`).
 */
function diffs(list: PackageColumn[]) {
  const rows = compareItems(list.map((c) => c.pkg));
  return list.map((_, i) => ({
    count: rows.filter((r) => r.has[i]).length,
    extra: list.length > 1 ? rows.filter((r) => r.has[i] && !r.same).map((r) => r.label) : [],
    extraKeys: new Set(list.length > 1 ? rows.filter((r) => r.has[i] && !r.same).map((r) => r.key) : []),
    missing: rows.filter((r) => !r.has[i]).map((r) => r.label),
  }));
}

/** "+E, +F, +2 lainnya" untuk baris ringkas. */
function extraText(extra: string[]) {
  if (!extra.length) return "";
  const shown = extra.slice(0, 2).map((x) => `+${x}`);
  return extra.length > 2 ? `${shown.join(", ")}, +${extra.length - 2} lainnya` : shown.join(", ");
}

const cheapestOf = (list: PackageColumn[]) => (list.length > 1 ? Math.min(...list.map((c) => offerTotal(c.pkg))) : null);

/** Baris ringkas paket satu vendor: nama, total, jumlah isi, dan beda singkatnya. */
export function PackageRows({
  list,
  selected,
  onToggleSelect,
  actions,
  pick,
}: {
  list: PackageColumn[];
  selected: string[];
  onToggleSelect: (id: string) => void;
  actions?: (c: PackageColumn) => ReactNode;
  pick: (c: PackageColumn) => ReactNode;
}) {
  const d = diffs(list);
  const min = cheapestOf(list);
  return (
    <ul className="flex flex-col">
      {list.map((c, i) => {
        const total = offerTotal(c.pkg);
        const name = c.pkg.packageName || "Paket";
        return (
          <li key={c.pkg.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2.5 last:border-0">
            <label className="hit-44 flex shrink-0 cursor-pointer items-center" title="Centang untuk dibandingkan">
              <input
                type="checkbox"
                checked={selected.includes(c.pkg.id)}
                onChange={() => onToggleSelect(c.pkg.id)}
                className="size-4 accent-[#1C1B29]"
                aria-label={`Bandingkan ${c.vendor.name} ${name}`}
              />
            </label>
            <div className="min-w-0 flex-1 basis-[180px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[14px] font-bold">{name}</span>
                {c.pkg.status === "dipilih" && <Status tone="info">Dipesan</Status>}
                {total === min && <Status tone="ok">Termurah</Status>}
              </div>
              <div className="text-[12px] text-muted">
                {d[i].count ? `${d[i].count} isi` : "Isi belum diisi"}
                {d[i].extra.length > 0 && <span className="font-semibold text-ink">, {extraText(d[i].extra)}</span>}
                {c.pkg.addons.length > 0 && `, ${c.pkg.addons.length} add-on`}
              </div>
            </div>
            <span className="text-[16px] font-extrabold tabular">{rupiahShort(total)}</span>
            <div className="flex items-center gap-1">
              {actions?.(c)}
              {pick(c)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Detail paket berjajar: rincian harga, pembayaran, dan isi. Isi yang hanya ada di paket ini ditandai,
 * isi paket lain yang tidak termasuk ditulis pudar di bawahnya. Dipakai saat "Lihat isi paket" dibuka
 * dan di dialog perbandingan antar vendor (`showVendor`).
 */
export function PackageDetails({
  list,
  allocation,
  showVendor,
  fileNames,
  pick,
}: {
  list: PackageColumn[];
  // Alokasi kategori untuk selisih; null bila anggota tidak boleh melihat Budget.
  allocation: number | null;
  showVendor: boolean;
  fileNames: Record<string, string>;
  pick?: (c: PackageColumn) => ReactNode;
}) {
  const d = diffs(list);
  const min = cheapestOf(list);
  return (
    <div className={cx("grid grid-cols-1 gap-3", list.length > 1 && "sm:grid-cols-2", list.length > 2 && "min-[1100px]:grid-cols-3")}>
      {list.map((c, i) => {
        const total = offerTotal(c.pkg);
        const dp = effectiveDp(c.pkg, c.vendor);
        const gap = allocation ? total - allocation : 0;
        return (
          <section key={c.pkg.id} className="flex flex-col gap-3 rounded-[16px] bg-surface p-4" aria-label={`${c.vendor.name} ${c.pkg.packageName ?? ""}`}>
            <div className="flex flex-col gap-0.5">
              {showVendor && <span className="text-[12px] font-semibold text-muted">{c.vendor.name}</span>}
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-[15px] font-bold">{c.pkg.packageName || "Paket"}</h4>
                {c.pkg.status === "dipilih" && <Status tone="info">Dipesan</Status>}
                {total === min && <Status tone="ok">Termurah</Status>}
              </div>
              <span className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] tabular">{rupiahShort(total)}</span>
              {allocation !== null && allocation > 0 && (
                <span className={cx("text-[12px] font-bold", gap < 0 ? "text-ok-fg" : gap > 0 ? "text-warn-fg" : "text-muted")}>
                  {gap < 0 ? `${rupiahShort(-gap)} di bawah alokasi` : gap > 0 ? `${rupiahShort(gap)} di atas alokasi` : "Pas dengan alokasi"}
                </span>
              )}
            </div>

            <dl className="flex flex-col gap-1 rounded-[12px] bg-sunken p-3 text-[13px]">
              <Line label="Harga paket">{rupiah(c.pkg.price)}</Line>
              {c.pkg.addons.map((a, j) => (
                <Line key={j} label={`${a.label}${a.qty > 1 ? ` x${a.qty}` : ""}`}>
                  {rupiah(a.qty * a.price)}
                </Line>
              ))}
              <Line label={c.pkg.dpCustom ? "DP (khusus paket ini)" : "DP"}>{dpText(dp)}</Line>
              <Line label="Pelunasan">{rupiah(Math.max(0, total - dpValue(dp)))}</Line>
              {showVendor && <Line label="Ketersediaan">{c.vendor.availability || (c.vendor.available ? "Tersedia" : "Belum dikonfirmasi")}</Line>}
            </dl>

            <div className="flex flex-col gap-1.5">
              <h5 className="text-[12px] font-semibold text-muted">Isi paket</h5>
              {c.pkg.includeItems.length === 0 ? (
                <p className="text-[13px] text-muted">Belum diisi.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-[13px]">
                  {c.pkg.includeItems.map((it, j) => {
                    const only = d[i].extraKeys.has(itemKey(it));
                    return (
                      <li key={j} className="flex gap-2">
                        {only ? (
                          <Plus size={15} className="mt-0.5 shrink-0 text-info-fg" aria-label="Tidak ada di semua paket" />
                        ) : (
                          <Check size={15} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden="true" />
                        )}
                        <span className={only ? "font-semibold" : undefined}>{it}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {d[i].missing.length > 0 && (
                <p className="text-[12px] leading-[1.5] text-muted">
                  <span className="font-semibold">Tidak termasuk:</span> {d[i].missing.join(", ")}
                </p>
              )}
            </div>

            {(c.pkg.notes || c.pkg.attachmentFileId) && (
              <div className="flex flex-col gap-1 text-[12px]">
                {c.pkg.notes && <p className="text-muted">{c.pkg.notes}</p>}
                {c.pkg.attachmentFileId && (
                  <a href={`/api/files/${c.pkg.attachmentFileId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start font-semibold underline">
                    <Paperclip size={13} aria-hidden="true" />
                    {fileNames[c.pkg.attachmentFileId] ?? "Brosur"}
                  </a>
                )}
              </div>
            )}

            {pick && <div className="mt-auto pt-1">{pick(c)}</div>}
          </section>
        );
      })}
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="min-w-0 text-muted">{label}</dt>
      <dd className="shrink-0 font-semibold tabular">{children}</dd>
    </div>
  );
}
