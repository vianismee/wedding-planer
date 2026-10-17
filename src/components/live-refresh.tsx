"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Muat ulang data halaman saat anggota lain menyimpan perubahan, tanpa refresh manual. */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Beberapa simpanan beruntun (misalnya import tamu) cukup dimuat sekali.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const es = new EventSource("/api/live");
    let connected = false;
    es.onmessage = refresh;
    // Setelah tersambung ulang (HP tidur, sinyal putus) mungkin ada perubahan yang terlewat.
    es.onopen = () => {
      if (connected) refresh();
      connected = true;
    };
    return () => {
      clearTimeout(timer);
      es.close();
    };
  }, [router]);

  return null;
}
