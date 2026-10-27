// Rencana tabungan: berapa yang perlu disetor per hari, minggu, atau bulan sampai jatuh tempo.
import { addDays, diffDays } from "./format";

export type Frequency = "harian" | "mingguan" | "bulanan";
export const FREQUENCIES: Frequency[] = ["harian", "mingguan", "bulanan"];
export const FREQ_LABEL: Record<Frequency, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan" };
export const PER_LABEL: Record<Frequency, string> = { harian: "per hari", mingguan: "per minggu", bulanan: "per bulan" };

type Goal = { target: number; frequency: string; startDate: string; dueDate: string | null };

const asFreq = (f: string): Frequency => (FREQUENCIES.includes(f as Frequency) ? (f as Frequency) : "bulanan");

/** Jumlah periode utuh dari `from` ke `to`. Bulan dihitung menurut kalender, misalnya 15 Jan ke 15 Mar = 2. */
function fullPeriods(from: string, to: string, f: Frequency) {
  const days = diffDays(from, to);
  if (days <= 0) return 0;
  if (f === "harian") return days;
  if (f === "mingguan") return Math.floor(days / 7);
  // Ikut addPeriods supaya mulai tanggal 31 tetap dihitung sebulan pada 28 Februari.
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  let n = (y2 - y1) * 12 + (m2 - m1);
  while (n > 0 && addPeriods(from, n, f) > to) n--;
  return n;
}

/** Tanggal awal periode ke-`n`. Tanggal 31 di bulan yang lebih pendek jadi akhir bulan itu. */
function addPeriods(iso: string, n: number, f: Frequency) {
  if (f === "harian") return addDays(iso, n);
  if (f === "mingguan") return addDays(iso, n * 7);
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
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
  return Math.max(1, full + (addPeriods(from, full, f) < to ? 1 : 0));
}

const dueOf = (goal: Goal, akadDate: string) => goal.dueDate ?? akadDate;
const perPeriodOf = (goal: Goal, due: string) => Math.ceil(goal.target / deposits(goal.startDate, due, asFreq(goal.frequency)));

/**
 * Yang seharusnya sudah terkumpul pada `date` menurut rencana awal. Hanya periode yang sudah lewat:
 * setoran periode berjalan masih boleh menyusul sampai periode itu habis.
 */
function expectedOn(goal: Goal, due: string, date: string) {
  if (date >= due) return goal.target;
  const f = asFreq(goal.frequency);
  const total = deposits(goal.startDate, due, f);
  return Math.min(goal.target, perPeriodOf(goal, due) * Math.min(total, fullPeriods(goal.startDate, date, f)));
}

/** Titik garis rencana untuk grafik: nilai yang diharapkan di setiap awal periode, sampai jatuh tempo. */
export function planPoints(goal: Goal, akadDate: string): { date: string; value: number }[] {
  const f = asFreq(goal.frequency);
  const due = dueOf(goal, akadDate);
  const out = [{ date: goal.startDate, value: 0 }];
  for (let n = 1; ; n++) {
    const date = addPeriods(goal.startDate, n, f);
    if (date >= due) break;
    out.push({ date, value: expectedOn(goal, due, date) });
  }
  out.push({ date: due, value: goal.target });
  return out;
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

/** `saved` adalah saldo bersih: setoran dikurangi penarikan. */
export function planFor(goal: Goal, saved: number, today: string, akadDate: string): Plan {
  const f = asFreq(goal.frequency);
  const due = dueOf(goal, akadDate);
  const remaining = Math.max(0, goal.target - saved);
  const perPeriod = perPeriodOf(goal, due);
  const expected = today >= due ? goal.target : expectedOn(goal, due, today);
  const left = today >= due ? 0 : deposits(today, due, f);
  const neededNow = left ? Math.ceil(remaining / left) : remaining;
  const status = remaining === 0 ? "tercapai" : today >= due ? "lewat" : saved >= expected ? "sesuai" : "tertinggal";
  return { frequency: f, due, saved, remaining, perPeriod, neededNow, expected, status };
}

/** Saldo bersih dari daftar transaksi. */
export const balanceOf = (rows: { kind: string; amount: number }[]) => rows.reduce((s, r) => s + (r.kind === "keluar" ? -r.amount : r.amount), 0);
