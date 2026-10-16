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
