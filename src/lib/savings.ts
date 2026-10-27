// Rencana tabungan: berapa yang perlu disetor per hari, minggu, atau bulan sampai jatuh tempo.
import { diffDays } from "./format";

export type Frequency = "harian" | "mingguan" | "bulanan";
export const FREQUENCIES: Frequency[] = ["harian", "mingguan", "bulanan"];
export const FREQ_LABEL: Record<Frequency, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan" };
export const PER_LABEL: Record<Frequency, string> = { harian: "per hari", mingguan: "per minggu", bulanan: "per bulan" };

const asFreq = (f: string): Frequency => (FREQUENCIES.includes(f as Frequency) ? (f as Frequency) : "bulanan");

/** Jumlah periode utuh dari `from` ke `to`. Bulan dihitung menurut kalender, misalnya 15 Jan ke 15 Mar = 2. */
function fullPeriods(from: string, to: string, f: Frequency) {
  const days = diffDays(from, to);
  if (days <= 0) return 0;
  if (f === "harian") return days;
  if (f === "mingguan") return Math.floor(days / 7);
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/**
 * Banyaknya setoran sebelum `to`: satu di awal tiap periode, termasuk periode terakhir yang tidak utuh.
 * Minimal satu, supaya target yang jatuh temponya dekat tetap punya angka setoran.
 */
function deposits(from: string, to: string, f: Frequency) {
  const days = diffDays(from, to);
  if (days <= 0) return 1;
  if (f === "harian") return days;
  if (f === "mingguan") return Math.ceil(days / 7);
  const full = fullPeriods(from, to, f);
  const [, , d1] = from.split("-").map(Number);
  const [, , d2] = to.split("-").map(Number);
  return Math.max(1, full + (d2 !== d1 ? 1 : 0));
}

export type Plan = {
  frequency: Frequency;
  due: string;
  saved: number;
  remaining: number;
  /** Rencana awal per periode, dari tanggal mulai sampai jatuh tempo. */
  perPeriod: number;
  /** Yang perlu disetor per periode mulai hari ini supaya target tercapai tepat waktu. */
  neededNow: number;
  /** Yang seharusnya sudah terkumpul hari ini menurut rencana awal. */
  expected: number;
  status: "tercapai" | "sesuai" | "tertinggal" | "lewat";
};

export function planFor(
  goal: { target: number; frequency: string; startDate: string; dueDate: string | null },
  saved: number,
  today: string,
  akadDate: string,
): Plan {
  const f = asFreq(goal.frequency);
  const due = goal.dueDate ?? akadDate;
  const remaining = Math.max(0, goal.target - saved);
  const total = deposits(goal.startDate, due, f);
  const perPeriod = Math.ceil(goal.target / total);
  // Hanya periode yang sudah lewat: setoran periode berjalan masih boleh menyusul sampai periode itu habis.
  const passed = Math.min(total, fullPeriods(goal.startDate, today, f));
  const expected = Math.min(goal.target, perPeriod * passed);
  const left = today >= due ? 0 : deposits(today, due, f);
  const neededNow = left ? Math.ceil(remaining / left) : remaining;
  const status = remaining === 0 ? "tercapai" : today >= due ? "lewat" : saved >= expected ? "sesuai" : "tertinggal";
  return { frequency: f, due, saved, remaining, perPeriod, neededNow, expected, status };
}
