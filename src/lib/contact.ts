/** Nomor WhatsApp ke format 62xxxx. 0812…, +62 812…, atau 812… (angka dari Excel) diterima. */
export function normPhone(v: string): string | null {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 9 && d.length <= 15 ? d : null;
}

/** Username Instagram tanpa @, juga dari tautan profil. */
export function normInstagram(v: string): string | null {
  const u = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

/** Isi {kode} di pola link undangan. Tanpa {kode}, kode ditambahkan sebagai ?to=. */
export function invitationLink(pattern: string | null | undefined, code: string) {
  if (!pattern) return null;
  if (pattern.includes("{kode}")) return pattern.replaceAll("{kode}", encodeURIComponent(code));
  return `${pattern}${pattern.includes("?") ? "&" : "?"}to=${encodeURIComponent(code)}`;
}

export const RSVP = {
  hadir: { name: "Hadir", tone: "ok" },
  tidak_hadir: { name: "Tidak hadir", tone: "neutral" },
  ragu: { name: "Masih ragu", tone: "warn" },
} as const;

export const waLink = (phone: string) => `https://wa.me/${phone}`;
export const igLink = (user: string) => `https://instagram.com/${user}`;
