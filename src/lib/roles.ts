// Izin anggota per halaman. Dipakai server (pemeriksaan akses) dan klien (pengaturan izin, tampilan lihat saja).

export type Area =
  | "dashboard"
  | "acara"
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

/**
 * Tingkat izin satu halaman. "own" hanya untuk Checklist: melihat dan mencentang tugas yang
 * ditugaskan ke dirinya sendiri (seperti peran Panitia).
 */
export type Level = "none" | "own" | "view" | "edit";
export type Perms = Record<Area, Level>;

export const LEVEL_LABEL: Record<Level, string> = { none: "Tidak ada", own: "Tugas sendiri", view: "Lihat", edit: "Ubah" };
const RANK: Record<Level, number> = { none: 0, own: 1, view: 2, edit: 3 };
/** Tingkat `l` tidak lebih tinggi dari `max`. */
export const levelWithin = (l: Level, max: Level) => RANK[l] <= RANK[max];

export const AREAS: { id: Area; name: string; help: string; levels: Level[] }[] = [
  { id: "dashboard", name: "Beranda", help: "Ringkasan persiapan. Angka uang hanya tampil bila Budget bisa dilihat.", levels: ["none", "view"] },
  { id: "acara", name: "Acara", help: "Rangkaian acara, rundown, dan link rundown untuk panitia.", levels: ["none", "view", "edit"] },
  { id: "jadwal", name: "Jadwal", help: "Janji temu dan agenda persiapan.", levels: ["none", "view", "edit"] },
  { id: "tamu", name: "Tamu", help: "Daftar tamu, undangan, dan ekspor CSV.", levels: ["none", "view", "edit"] },
  { id: "budget", name: "Budget", help: "Anggaran, pengeluaran, termin, dan bukti bayar.", levels: ["none", "view", "edit"] },
  { id: "catering", name: "Catering", help: "Rencana porsi dan menu.", levels: ["none", "view", "edit"] },
  { id: "vendor", name: "Vendor", help: "Daftar vendor, penawaran, dan perbandingan harga.", levels: ["none", "view", "edit"] },
  { id: "checklist", name: "Checklist", help: "Tugas persiapan. Tugas sendiri: hanya melihat dan mencentang tugas yang ditugaskan kepadanya.", levels: ["none", "own", "view", "edit"] },
  { id: "seserahan", name: "Seserahan", help: "Barang seserahan dan mahar.", levels: ["none", "view", "edit"] },
  { id: "dokumen", name: "Dokumen nikah", help: "Persyaratan dan scan dokumen pribadi seperti KTP dan KK.", levels: ["none", "view", "edit"] },
  { id: "moodboard", name: "Moodboard", help: "Papan konsep dekor, busana, dan warna.", levels: ["none", "view", "edit"] },
  { id: "pengaturan", name: "Pengaturan pernikahan", help: "Data pernikahan, anggota, undangan, dan izin. Akun pribadi selalu bisa diatur sendiri.", levels: ["none", "view", "edit"] },
];
export const AREA_IDS = AREAS.map((a) => a.id);

// Akses penuh = tingkat tertinggi tiap halaman (Beranda hanya punya Lihat).
export const FULL_PERMS = Object.fromEntries(AREAS.map((a) => [a.id, a.levels.at(-1)])) as Perms;
export const NO_PERMS = Object.fromEntries(AREA_IDS.map((a) => [a, "none"])) as Perms;

/* ---------- Peran ---------- */

// Peran bawaan: isinya sama dengan akses sebelum izin bisa diatur, jadi anggota lama tidak berubah aksesnya.
export const PRESETS = {
  pasangan: { name: "Pasangan", perms: FULL_PERMS },
  keluarga: {
    name: "Keluarga",
    perms: { ...NO_PERMS, dashboard: "view", acara: "view", jadwal: "edit", tamu: "edit", checklist: "edit", seserahan: "edit", moodboard: "edit" },
  },
  panitia: { name: "Panitia", perms: { ...NO_PERMS, acara: "view", checklist: "own" } },
} satisfies Record<string, { name: string; perms: Perms }>;
export type PresetKey = keyof typeof PRESETS;
export const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];
export const isPreset = (key: string): key is PresetKey => key in PRESETS;

/** Peran yang disimpan per pernikahan: peran bawaan yang izinnya diubah, atau peran buatan sendiri. */
export type RoleDef = { key: string; name: string; perms: Perms };

/** Semua peran yang bisa dipilih untuk anggota (selain Pemilik), bawaan lebih dulu. */
export function roleList(saved: RoleDef[]): RoleDef[] {
  const presets = PRESET_KEYS.map((k) => saved.find((r) => r.key === k) ?? { key: k, ...PRESETS[k] });
  return [...presets, ...saved.filter((r) => !isPreset(r.key))];
}

export function roleName(key: string, saved: RoleDef[]) {
  if (key === "pemilik") return "Pemilik";
  return roleList(saved).find((r) => r.key === key)?.name ?? "Peran dihapus";
}

/** Lengkapi izin dari database: halaman baru atau tingkat yang tidak dikenal jadi "Tidak ada". */
export function normalize(p: Partial<Record<string, string>> | null | undefined): Perms {
  const out = { ...NO_PERMS };
  for (const a of AREAS) {
    const v = p?.[a.id] as Level | undefined;
    if (v && a.levels.includes(v)) out[a.id] = v;
  }
  return out;
}

/**
 * Izin akhir seorang anggota: Pemilik selalu penuh; lainnya izin perannya, lalu pengecualian khusus
 * anggota itu menimpa halaman yang disebut.
 */
export function resolvePerms(role: string, override: Partial<Perms> | null | undefined, saved: RoleDef[]): Perms {
  if (role === "pemilik") return FULL_PERMS;
  const base = roleList(saved).find((r) => r.key === role)?.perms ?? NO_PERMS;
  return normalize({ ...base, ...override });
}

/** Boleh melihat (atau mengubah) halaman ini. "Tugas sendiri" di Checklist dihitung boleh melihat. */
export function can(perms: Perms, area: Area, need: "view" | "edit" = "view") {
  return need === "edit" ? perms[area] === "edit" : perms[area] !== "none";
}

/** `p` tidak memberi izin lebih tinggi dari `max` di halaman mana pun. Dipakai supaya pengelola tidak bisa memberi lebih dari yang ia punya. */
export function within(p: Perms, max: Perms) {
  return AREA_IDS.every((a) => RANK[p[a]] <= RANK[max[a]]);
}

/** Halaman pertama yang boleh dibuka, untuk tujuan setelah masuk atau saat akses ditolak. */
export function homeFor(perms: Perms) {
  const first = (["dashboard", "acara", "checklist", "jadwal", "tamu", "moodboard"] as Area[]).find((a) => can(perms, a));
  return first ? `/${first}` : "/pengaturan";
}

const listText = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} dan ${xs.at(-1)}`);

/** Izin dalam satu atau dua kalimat, misalnya "Bisa mengubah Tamu dan Checklist. Hanya melihat Acara dan rundown." */
export function describePerms(p: Perms) {
  const names = (lv: Level) => AREAS.filter((a) => p[a.id] === lv).map((a) => a.name);
  if (AREA_IDS.every((a) => p[a] === FULL_PERMS[a])) return "Akses penuh ke semua bagian.";
  const edit = names("edit");
  const view = names("view");
  const parts: string[] = [];
  if (edit.length) parts.push(`Bisa mengubah ${listText(edit)}.`);
  if (view.length) parts.push(`Hanya melihat ${listText(view)}.`);
  if (p.checklist === "own") parts.push("Melihat dan mencentang tugasnya sendiri di Checklist.");
  return parts.join(" ") || "Belum punya akses ke bagian mana pun.";
}

export const MAX_MEMBERS = 10;
export const MAX_ROLES = 12;

// Jenis file menentukan halaman yang izinnya dipakai untuk mengunggah dan melihat.
// Scan dokumen (KTP, KK, akta) ikut izin Dokumen nikah.
export const FILE_AREA: Record<string, Area> = { receipt: "budget", offer: "vendor", document: "dokumen", moodboard: "moodboard" };
