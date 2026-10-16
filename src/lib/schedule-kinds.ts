import { CalendarDays, MapPin, Shirt, Users, Utensils, type LucideIcon } from "lucide-react";

// Jenis jadwal kustom. Ikon dipilih sesuai isi (DESIGN.md 8).
export const SCHEDULE_KINDS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "test_food", name: "Test food", icon: Utensils },
  { id: "fitting", name: "Fitting busana", icon: Shirt },
  { id: "survey", name: "Survey lokasi", icon: MapPin },
  { id: "meeting", name: "Meeting vendor", icon: Users },
  { id: "lainnya", name: "Lainnya", icon: CalendarDays },
];

export const scheduleKind = (id: string) => SCHEDULE_KINDS.find((k) => k.id === id) ?? SCHEDULE_KINDS[4];
