// Format angka, rupiah, dan tanggal sesuai DESIGN.md bagian 7.

const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const monthShort = (m: number) => MONTHS_SHORT[m];
export const monthLong = (m: number) => MONTHS_LONG[m];
export const dayShort = (d: number) => DAYS_SHORT[d];

/** Rp 35.000.000 */
export function rupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** Rp 35 jt, Rp 3,5 jt, Rp 750 rb */
export function rupiahShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${fmt(abs / 1_000)} rb`;
  return `${sign}Rp ${abs}`;
}

export function number(n: number) {
  return n.toLocaleString("id-ID");
}

/* ---------- Tanggal ----------
   Semua tanggal disimpan sebagai string "YYYY-MM-DD" (tanpa zona waktu).
   "Hari ini" dihitung di zona Asia/Jakarta. */

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

function toUTC(iso: string) {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m, d);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(toUTC(iso) + days * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Selisih hari b - a */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function weekday(iso: string) {
  return new Date(toUTC(iso)).getUTCDay();
}

/** Sab, 13 Feb 2027 */
export function dateShort(iso: string | null | undefined) {
  if (!iso) return "Tanggal belum diisi";
  const { y, m, d } = parts(iso);
  return `${DAYS_SHORT[weekday(iso)]}, ${d} ${MONTHS_SHORT[m]} ${y}`;
}

/** Sab, 13 Feb (tanpa tahun) */
export function dateShorter(iso: string) {
  const { m, d } = parts(iso);
  return `${DAYS_SHORT[weekday(iso)]}, ${d} ${MONTHS_SHORT[m]}`;
}

/** Sabtu, 13 Februari 2027 */
export function dateLong(iso: string | null | undefined) {
  if (!iso) return "Tanggal belum diisi";
  const { y, m, d } = parts(iso);
  return `${DAYS_LONG[weekday(iso)]}, ${d} ${MONTHS_LONG[m]} ${y}`;
}

export function dayName(iso: string) {
  return DAYS_LONG[weekday(iso)];
}

export function dayMonth(iso: string) {
  const { y, m, d } = parts(iso);
  return { day: d, month: MONTHS_SHORT[m], year: y };
}

/** "08.00" dari "08:00" */
export function time(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5).replace(":", ".");
}

/** "5 hari lagi", "Hari ini", "Besok", "Lewat 3 hari" */
export function relativeDays(iso: string, today = todayISO()) {
  const n = diffDays(today, iso);
  if (n === 0) return "Hari ini";
  if (n === 1) return "Besok";
  if (n > 1) return `${n} hari lagi`;
  if (n === -1) return "Kemarin";
  return `Lewat ${-n} hari`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

/** Mengubah "Rp 3.500.000" / "3500000" / "3,5jt" menjadi angka. */
export function parseRupiah(input: string | null | undefined): number {
  if (!input) return 0;
  const s = String(input).toLowerCase().replace(/rp/g, "").trim();
  const jt = /(jt|juta)$/.test(s);
  const rb = /(rb|ribu)$/.test(s);
  const core = s.replace(/(jt|juta|rb|ribu)$/, "").trim();
  if (jt || rb) {
    const v = parseFloat(core.replace(/\./g, "").replace(",", "."));
    return Math.round((isNaN(v) ? 0 : v) * (jt ? 1_000_000 : 1_000));
  }
  const digits = core.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** "tokopedia.com" dari URL lengkap, untuk label link pembelian. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
