export type Role = "pemilik" | "pasangan" | "keluarga" | "panitia";

export const ROLE_LABEL: Record<Role, string> = {
  pemilik: "Pemilik",
  pasangan: "Pasangan",
  keluarga: "Keluarga",
  panitia: "Panitia",
};

export const ROLE_HELP: Record<Exclude<Role, "pemilik">, string> = {
  pasangan: "Akses penuh, termasuk budget, vendor, dan dokumen.",
  keluarga: "Mengelola tamu, checklist, seserahan, dan moodboard. Tidak melihat budget dan dokumen.",
  panitia: "Hanya melihat rundown dan tugasnya sendiri.",
};

export type Area =
  | "dashboard"
  | "acara"
  | "acara.edit"
  | "jadwal"
  | "tamu"
  | "budget"
  | "catering"
  | "vendor"
  | "checklist"
  | "seserahan"
  | "dokumen"
  | "moodboard"
  | "pengaturan";

const FULL: Role[] = ["pemilik", "pasangan"];

export const ACCESS: Record<Area, Role[]> = {
  dashboard: [...FULL, "keluarga"],
  jadwal: [...FULL, "keluarga"],
  acara: [...FULL, "keluarga", "panitia"],
  "acara.edit": FULL,
  tamu: [...FULL, "keluarga"],
  budget: FULL,
  catering: FULL,
  vendor: FULL,
  checklist: [...FULL, "keluarga", "panitia"],
  seserahan: [...FULL, "keluarga"],
  dokumen: FULL,
  moodboard: [...FULL, "keluarga"],
  pengaturan: FULL,
};

export function can(role: Role, area: Area) {
  return ACCESS[area].includes(role);
}

export const MAX_MEMBERS = 10;

// Jenis file menentukan siapa yang boleh mengunggah dan melihat.
// Scan dokumen (KTP, KK, akta) hanya untuk peran Pasangan.
export const FILE_AREA: Record<string, Area> = { receipt: "budget", offer: "vendor", document: "dokumen", moodboard: "moodboard" };
