// Konstanta moodboard yang dipakai server (validasi) dan klien (kanvas).

export const MOOD_BOARDS = [
  { id: "utama", name: "Konsep utama" },
  { id: "akad", name: "Akad" },
  { id: "resepsi", name: "Resepsi" },
] as const;
export type MoodBoardId = (typeof MOOD_BOARDS)[number]["id"];

// Tag bawaan hanya saran. Anggota bisa menambah tag sendiri dari panel detail kartu.
export const MOOD_TAGS = ["Dekor", "Pelaminan", "Busana", "Warna", "Bunga", "Makanan", "Suvenir"];
export const MOOD_TAG_MAX = 30;

// Warna latar kelompok memakai pasangan warna status DESIGN.md supaya tetap dalam palet.
export const MOOD_GROUP_COLORS: Record<string, { bg: string; line: string; name: string }> = {
  netral: { bg: "rgba(255, 255, 255, 0.6)", line: "#d9d8e4", name: "Netral" },
  krem: { bg: "rgba(251, 240, 217, 0.7)", line: "#ebddba", name: "Krem" },
  lavender: { bg: "rgba(231, 228, 251, 0.7)", line: "#cfc9f2", name: "Lavender" },
  hijau: { bg: "rgba(238, 247, 204, 0.75)", line: "#d5e6a0", name: "Hijau" },
  peach: { bg: "rgba(252, 229, 216, 0.7)", line: "#f0c9b3", name: "Peach" },
};

export const MOOD_LIMITS = { nodes: 300, edges: 600, groups: 40, swatches: 6, tags: 12 };
