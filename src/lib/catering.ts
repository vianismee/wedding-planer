import type { CateringExtra } from "@/db/schema";

export type CateringInput = {
  mode: string;
  paxSource: string;
  manualPax: number;
  bufferPercent: number;
  pricePerPax: number;
  ingredientPerPax: number;
  cooks: number;
  cookWage: number;
  cookDays: number;
  equipmentCost: number;
  extras: CateringExtra[];
};

export type CateringBreakdown = {
  basePax: number;
  portions: number;
  lines: { label: string; detail: string; amount: number }[];
  total: number;
  perPortion: number;
};

const fmt = (n: number) => n.toLocaleString("id-ID");

/**
 * Menghitung kebutuhan catering.
 * Porsi = jumlah orang (dari daftar tamu atau manual) ditambah cadangan, dibulatkan ke atas.
 */
export function computeCatering(p: CateringInput, guestPax: number): CateringBreakdown {
  const basePax = p.paxSource === "manual" ? p.manualPax : guestPax;
  const portions = Math.ceil(basePax * (1 + p.bufferPercent / 100));
  const lines: CateringBreakdown["lines"] = [];

  if (p.mode === "per_pax") {
    lines.push({ label: "Paket per pax", detail: `${fmt(portions)} porsi x Rp ${fmt(p.pricePerPax)}`, amount: portions * p.pricePerPax });
  } else {
    lines.push({ label: "Bahan makanan", detail: `${fmt(portions)} porsi x Rp ${fmt(p.ingredientPerPax)}`, amount: portions * p.ingredientPerPax });
    lines.push({
      label: "Upah juru masak",
      detail: `${p.cooks} orang x Rp ${fmt(p.cookWage)} x ${p.cookDays} hari`,
      amount: p.cooks * p.cookWage * p.cookDays,
    });
    if (p.equipmentCost) lines.push({ label: "Sewa alat masak dan gas", detail: "", amount: p.equipmentCost });
  }
  for (const e of p.extras) {
    if (!e.label && !e.price) continue;
    lines.push({ label: e.label || "Tambahan", detail: `${fmt(e.qty)} x Rp ${fmt(e.price)}`, amount: e.qty * e.price });
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { basePax, portions, lines, total, perPortion: portions ? Math.round(total / portions) : 0 };
}
