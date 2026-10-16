import { BookOpen, Building2, CalendarDays, Droplets, Heart, Home, type LucideIcon } from "lucide-react";

// Ikon dipilih sesuai isi acara (DESIGN.md 8), tanpa sparkle atau bintang.
export function eventIcon(kind: string): LucideIcon {
  switch (kind) {
    case "akad":
      return BookOpen;
    case "resepsi":
      return Building2;
    case "lamaran":
      return Heart;
    case "adat":
      return Droplets;
    case "pengajian":
      return Home;
    default:
      return CalendarDays;
  }
}

export function eventTone(kind: string) {
  switch (kind) {
    case "akad":
      return "bg-ok-bg text-ok-fg";
    case "resepsi":
      return "bg-info-bg text-info-fg";
    case "lamaran":
      return "bg-warn-bg text-warn-fg";
    default:
      return "bg-ground text-ink";
  }
}

export const EVENT_KINDS = [
  { id: "akad", name: "Akad nikah" },
  { id: "resepsi", name: "Resepsi" },
  { id: "lamaran", name: "Lamaran" },
  { id: "adat", name: "Prosesi adat" },
  { id: "pengajian", name: "Pengajian" },
  { id: "lainnya", name: "Lainnya" },
];

export const EVENT_STATUS: Record<string, { name: string; tone: "ok" | "info" | "warn" }> = {
  persiapan: { name: "Persiapan", tone: "info" },
  lokasi_belum: { name: "Lokasi belum fix", tone: "warn" },
  selesai: { name: "Selesai", tone: "ok" },
};
