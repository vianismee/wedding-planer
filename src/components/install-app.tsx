"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Modal } from "./forms";
import { Button, cx } from "./kit";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Event `beforeinstallprompt` hanya muncul sekali di awal, jadi disimpan secara global.
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const noop = () => () => {};

function useInstallState() {
  const canPrompt = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred !== null,
    () => false,
  );
  // Saat render di server dianggap "sudah terpasang" supaya tombol tidak berkedip.
  const standalone = useSyncExternalStore(
    noop,
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => true,
  );
  const ios = useSyncExternalStore(
    noop,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false,
  );
  return { standalone, ios, canPrompt };
}

/** Tombol "Pasang aplikasi". Tersembunyi bila sudah terpasang atau browser tidak mendukung. */
export function InstallApp({ variant }: { variant: "sidebar" | "sheet" | "card" }) {
  const { standalone, ios, canPrompt } = useInstallState();
  const [iosHelp, setIosHelp] = useState(false);

  if (standalone) {
    return variant === "card" ? <p className="text-[13px] text-muted">Rukun sudah terpasang di perangkat ini.</p> : null;
  }
  if (!canPrompt && !ios) {
    return variant === "card" ? (
      <p className="text-[13px] text-muted">
        Buka situs ini di Chrome atau Edge, lalu pilih menu browser dan klik Pasang aplikasi atau Tambahkan ke layar utama.
      </p>
    ) : null;
  }

  const onClick = async () => {
    if (canPrompt && deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      notify();
    } else if (ios) setIosHelp(true);
  };

  const label = "Pasang aplikasi";
  const trigger =
    variant === "sidebar" ? (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-medium text-nav hover:bg-white/10"
      >
        <Download size={18} aria-hidden="true" />
        {label}
      </button>
    ) : variant === "sheet" ? (
      <button
        type="button"
        onClick={onClick}
        className="col-span-2 flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-ink px-4 text-[14px] font-bold text-white"
      >
        <Download size={18} aria-hidden="true" />
        {label} di HP
      </button>
    ) : (
      <Button onClick={onClick} className="self-start">
        <Download size={16} aria-hidden="true" />
        {label}
      </Button>
    );

  return (
    <>
      {trigger}
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Pasang Rukun di iPhone" description="Safari belum punya tombol pasang otomatis. Caranya tiga langkah:">
        <ol className="flex flex-col gap-3 text-[14px]">
          {[
            [Share, "Ketuk tombol Bagikan di bar bawah Safari."],
            [SquarePlus, "Gulir ke bawah, pilih Tambah ke Layar Utama."],
            [Download, "Ketuk Tambah. Rukun muncul di layar utama seperti aplikasi biasa."],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof Share;
            return (
              <li key={i} className={cx("flex items-center gap-3 rounded-[14px] bg-sunken p-3")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface font-extrabold">{i + 1}</span>
                <I size={18} className="shrink-0" aria-hidden="true" />
                <span>{text as string}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-[12px] text-muted">Gunakan Safari. Browser lain di iPhone belum tentu menampilkan pilihan ini.</p>
        <Button onClick={() => setIosHelp(false)} className="self-end">
          Mengerti
        </Button>
      </Modal>
    </>
  );
}
