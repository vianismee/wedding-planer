import type { OfferAddon } from "@/db/schema";
import { rupiahShort } from "./format";

export const addonsTotal = (addons: OfferAddon[]) => addons.reduce((s, a) => s + a.qty * a.price, 0);

/** Total penawaran = harga paket + semua add-on di luar paket. */
export const offerTotal = (o: { price: number; addons: OfferAddon[] }) => o.price + addonsTotal(o.addons);

type DpInput = { price: number; addons: OfferAddon[]; dpType: string; dpPercent: number; dpAmount: number };

/** Nominal DP: persen dari total, nominal tetap (tidak lebih dari total), atau 0 bila tanpa DP. */
export function dpValue(o: DpInput) {
  const total = offerTotal(o);
  if (o.dpType === "none") return 0;
  if (o.dpType === "nominal") return Math.min(Math.max(0, o.dpAmount), total);
  return Math.round((total * o.dpPercent) / 100);
}

/** "30%, Rp 1,4 jt", "Rp 2 jt", atau "Tidak ada DP" */
export function dpText(o: DpInput) {
  if (o.dpType === "none") return "Tidak ada DP";
  if (o.dpType === "nominal") return rupiahShort(dpValue(o));
  return `${o.dpPercent}%, ${rupiahShort(dpValue(o))}`;
}

/** Nama termin DP untuk Budget. */
export const dpLabel = (o: DpInput) => (o.dpType === "percent" ? `DP ${o.dpPercent}%` : "DP");

/** DP yang berlaku untuk satu paket: DP paket bila diatur sendiri, selain itu DP calon vendornya. Total tetap dari paket. */
export function effectiveDp(
  pkg: { price: number; addons: OfferAddon[]; dpCustom: boolean; dpType: string; dpPercent: number; dpAmount: number },
  vendor: { dpType: string; dpPercent: number; dpAmount: number },
): DpInput {
  const src = pkg.dpCustom ? pkg : vendor;
  return { price: pkg.price, addons: pkg.addons, dpType: src.dpType, dpPercent: src.dpPercent, dpAmount: src.dpAmount };
}

/** Kunci pencocokan isi paket: huruf kecil, spasi dirapikan, tanda baca di ujung dibuang. */
export const itemKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s\-–•*.,;:]+|[\s\-–•*.,;:]+$/g, "");

/**
 * Gabungan isi beberapa paket untuk tabel perbandingan. Setiap baris berisi teks item (dari paket
 * pertama yang memuatnya) dan, per paket, apakah item itu ada. Urutan mengikuti paket pertama, lalu
 * item tambahan dari paket berikutnya. `same` bila item ada di semua paket.
 */
export function compareItems(packages: { includeItems: string[] }[]) {
  const rows: { key: string; label: string; has: boolean[] }[] = [];
  const byKey = new Map<string, (typeof rows)[number]>();
  packages.forEach((p, i) => {
    for (const item of p.includeItems) {
      const key = itemKey(item);
      if (!key) continue;
      let row = byKey.get(key);
      if (!row) {
        row = { key, label: item.trim(), has: packages.map(() => false) };
        byKey.set(key, row);
        rows.push(row);
      }
      row.has[i] = true;
    }
  });
  return rows.map((r) => ({ ...r, same: r.has.every(Boolean) }));
}
