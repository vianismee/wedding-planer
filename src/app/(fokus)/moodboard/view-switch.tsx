"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const QUERY = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Hanya satu tampilan yang dipasang: kanvas di tablet dan laptop, galeri di HP. Kanvas tidak ikut
 * terpasang di HP supaya HP tidak membuka aliran realtime dan kehadiran yang tidak dipakai.
 */
export function ViewSwitch({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  const isWide = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => null);
  if (isWide === null) return <p className="p-4 text-[14px] text-muted">Memuat moodboard…</p>;
  return isWide ? wide : narrow;
}
