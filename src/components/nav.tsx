"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  CalendarClock,
  FileText,
  Gift,
  LayoutGrid,
  ListChecks,
  LogOut,
  Settings,
  Store,
  Users,
  Wallet,
  Utensils,
  Images,
  Ellipsis,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, cx } from "./kit";
import { setCapsuleItems } from "@/actions/anggota";
import { useConfirm } from "./confirm";
import { InstallApp } from "./install-app";
import { Modal } from "./forms";

export type NavId =
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

const ITEMS: Record<
  NavId,
  { href: string; label: string; short: string; icon: LucideIcon }
> = {
  dashboard: {
    href: "/dashboard",
    label: "Dashboard",
    short: "Beranda",
    icon: LayoutGrid,
  },
  acara: {
    href: "/acara",
    label: "Rangkaian Acara",
    short: "Acara",
    icon: CalendarDays,
  },
  jadwal: { href: "/jadwal", label: "Jadwal", short: "Jadwal", icon: CalendarClock },
  tamu: { href: "/tamu", label: "Daftar Tamu", short: "Tamu", icon: Users },
  budget: { href: "/budget", label: "Budget", short: "Budget", icon: Wallet },
  catering: {
    href: "/catering",
    label: "Catering",
    short: "Catering",
    icon: Utensils,
  },
  vendor: { href: "/vendor", label: "Vendor", short: "Vendor", icon: Store },
  checklist: {
    href: "/checklist",
    label: "Checklist",
    short: "Checklist",
    icon: ListChecks,
  },
  seserahan: {
    href: "/seserahan",
    label: "Seserahan",
    short: "Seserahan",
    icon: Gift,
  },
  dokumen: {
    href: "/dokumen",
    label: "Dokumen Nikah",
    short: "Dokumen",
    icon: FileText,
  },
  moodboard: {
    href: "/moodboard",
    label: "Moodboard",
    short: "Moodboard",
    icon: Images,
  },
  pengaturan: {
    href: "/pengaturan",
    label: "Pengaturan",
    short: "Pengaturan",
    icon: Settings,
  },
};

function useActive() {
  const path = usePathname();
  return (href: string) => path === href || path.startsWith(href + "/");
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/masuk");
    router.refresh();
  };
}

export function Sidebar({
  items,
  userName,
  weddingName,
}: {
  items: NavId[];
  userName: string;
  weddingName: string;
}) {
  const isActive = useActive();
  const signOut = useSignOut();
  const main = items.filter((i) => i !== "pengaturan");
  return (
    <aside className="on-ink sticky top-4 hidden h-[calc(100dvh-32px)] w-[236px] shrink-0 flex-col gap-8 overflow-y-auto rounded-[28px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-ink px-[18px] pb-[18px] pt-7 min-[900px]:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-2 text-white no-underline"
      >
        <span
          className="flex size-9 items-center justify-center rounded-full bg-white"
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1C1B29"
            strokeWidth="2.2"
          >
            <circle cx="9" cy="13" r="5" />
            <circle cx="15" cy="13" r="5" />
          </svg>
        </span>
        <span className="text-[22px] font-extrabold tracking-[-0.02em]">
          Rukun
        </span>
      </Link>
      <nav aria-label="Navigasi utama" className="flex flex-col gap-1.5">
        {main.map((id) => {
          const it = ITEMS[id];
          const active = isActive(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={id}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] no-underline transition-colors duration-150",
                active
                  ? "bg-accent font-bold text-ink"
                  : "font-medium text-nav hover:bg-white/10",
              )}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-white/10 pt-4">
        <p className="px-4 text-[12px] text-[#b9b8c8]">
          <span className="block truncate font-semibold text-white">
            {weddingName}
          </span>
          <span className="block truncate">Masuk sebagai {userName}</span>
        </p>
        <InstallApp variant="sidebar" />
        {items.includes("pengaturan") && (
          <Link
            href="/pengaturan"
            aria-current={isActive("/pengaturan") ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] no-underline",
              isActive("/pengaturan")
                ? "bg-accent font-bold text-ink"
                : "font-medium text-nav hover:bg-white/10",
            )}
          >
            <Settings size={18} aria-hidden="true" />
            Pengaturan
          </Link>
        )}
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-medium text-nav hover:bg-white/10"
        >
          <LogOut size={18} aria-hidden="true" />
          Keluar
        </button>
      </div>
    </aside>
  );
}

/** Capsule bar untuk layar di bawah 900px (DESIGN.md 5). Maksimal 5 item. */
// Menu yang hanya bisa dipakai di tablet dan laptop: tidak boleh masuk capsule,
// dan di menu Lainnya hanya muncul mulai 768px.
const WIDE_ONLY: NavId[] = ["moodboard"];
const CAPSULE_MAX = 4;
const CAPSULE_DEFAULT: NavId[] = [
  "dashboard",
  "acara",
  "tamu",
  "budget",
  "checklist",
];

function defaultCapsule(items: NavId[]) {
  return CAPSULE_DEFAULT.filter((i) => items.includes(i)).slice(0, CAPSULE_MAX);
}

export function Capsule({
  items,
  saved,
}: {
  items: NavId[];
  saved: string[] | null;
}) {
  const isActive = useActive();
  const signOut = useSignOut();
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  // Pilihan anggota (bila ada) dipakai lebih dulu; menu yang tidak boleh dibuka perannya diabaikan.
  const custom = (saved ?? [])
    .filter((i): i is NavId => items.includes(i as NavId) && !WIDE_ONLY.includes(i as NavId))
    .slice(0, CAPSULE_MAX);
  const primary = custom.length ? custom : defaultCapsule(items);
  const rest = items.filter((i) => !primary.includes(i));
  const moreActive = rest.some((i) => isActive(ITEMS[i].href));

  const itemClass = (active: boolean) =>
    cx(
      "flex h-12 items-center justify-center rounded-full transition-[width,background-color] duration-200 ease-out",
      active
        ? "gap-2 bg-accent px-4 text-[13px] font-bold text-ink"
        : "w-12 text-nav hover:bg-white/10",
    );

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="on-ink fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink p-2 shadow-float min-[900px]:hidden"
        style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        {primary.map((id) => {
          const it = ITEMS[id];
          const active = isActive(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={id}
              href={it.href}
              aria-label={active ? undefined : it.short}
              aria-current={active ? "page" : undefined}
              className={cx(itemClass(active), "no-underline")}
            >
              <Icon size={20} aria-hidden="true" />
              {active && <span>{it.short}</span>}
            </Link>
          );
        })}
        <button
          type="button"
          aria-label={moreActive ? undefined : "Lainnya"}
          aria-haspopup="dialog"
          onClick={() => setMore(true)}
          className={itemClass(moreActive)}
        >
          <Ellipsis size={20} aria-hidden="true" />
          {moreActive && <span>Lainnya</span>}
        </button>
      </nav>
      <Modal
        open={more}
        onClose={() => {
          setMore(false);
          setEditing(false);
        }}
        title={editing ? "Atur menu capsule" : "Lainnya"}
        description={
          editing
            ? `Pilih sampai ${CAPSULE_MAX} menu yang tampil di bar bawah. Menu lain tetap ada di Lainnya.`
            : undefined
        }
      >
        {editing ? (
          <CapsuleEditor
            items={items.filter((i) => !WIDE_ONLY.includes(i))}
            current={primary}
            isCustom={custom.length > 0}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <nav aria-label="Menu lainnya" className="grid grid-cols-2 gap-2">
              {rest.map((id) => {
                const it = ITEMS[id];
                const Icon = it.icon;
                const active = isActive(it.href);
                return (
                  <Link
                    key={id}
                    href={it.href}
                    onClick={() => setMore(false)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-14 items-center gap-3 rounded-2xl px-4 text-[14px] font-semibold no-underline",
                      active ? "bg-accent text-ink" : "bg-ground text-ink",
                      WIDE_ONLY.includes(id) && "max-[767px]:hidden",
                    )}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {it.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-ground px-4 text-left text-[14px] font-semibold"
              >
                <LogOut size={18} aria-hidden="true" />
                Keluar
              </button>
              <InstallApp variant="sheet" />
            </nav>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-outline px-4 text-[13px] font-bold"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              Atur menu capsule
            </button>
          </>
        )}
      </Modal>
    </>
  );
}

/** Editor menu capsule: pilih sampai 4 menu dan atur urutannya. */
function CapsuleEditor({
  items,
  current,
  isCustom,
  onDone,
}: {
  items: NavId[];
  current: NavId[];
  isCustom: boolean;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<NavId[]>(current);
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  const full = picked.length >= CAPSULE_MAX;

  const toggle = (id: NavId) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < CAPSULE_MAX
          ? [...p, id]
          : p,
    );
  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const n = [...p];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const save = (list: NavId[]) =>
    start(async () => {
      const r = await setCapsuleItems(list);
      if (!r.ok) {
        await dialogs.alert({ title: "Belum berhasil", description: r.error });
        return;
      }
      onDone();
    });

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="capsule-order" className="flex flex-col gap-2">
        <h3 id="capsule-order" className="text-[12px] font-semibold text-muted">
          Tampil di capsule, {picked.length} dari {CAPSULE_MAX}
        </h3>
        {picked.length === 0 ? (
          <p className="rounded-2xl bg-sunken px-4 py-3 text-[13px] text-muted">
            Belum ada menu. Pilih dari daftar di bawah.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {picked.map((id, i) => {
              const it = ITEMS[id];
              const Icon = it.icon;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-2xl bg-ground py-1 pl-4 pr-1"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[14px] font-semibold">
                    {it.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Naikkan ${it.label}`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface disabled:opacity-30"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Turunkan ${it.label}`}
                    disabled={i === picked.length - 1}
                    onClick={() => move(i, 1)}
                    className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface disabled:opacity-30"
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="capsule-all" className="flex flex-col gap-2">
        <h3 id="capsule-all" className="text-[12px] font-semibold text-muted">
          Semua menu
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {items.map((id) => {
            const it = ITEMS[id];
            const Icon = it.icon;
            const on = picked.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(id)}
                className={cx(
                  "flex min-h-12 items-center gap-2.5 rounded-2xl border-2 px-3 text-left text-[13px] font-semibold transition-colors duration-150 disabled:opacity-40",
                  on ? "border-ink bg-surface" : "border-transparent bg-ground",
                )}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="min-w-0 flex-1">{it.label}</span>
                {on && (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold">
                    Dipilih
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {full && (
          <p className="text-[12px] text-muted">
            Sudah {CAPSULE_MAX} menu. Lepas salah satu untuk mengganti.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isCustom ? (
          <Button variant="ghost" disabled={pending} onClick={() => save([])}>
            Kembalikan bawaan
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ground" onClick={onDone}>
            Batal
          </Button>
          <Button
            disabled={pending || picked.length === 0}
            onClick={() => save(picked)}
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
