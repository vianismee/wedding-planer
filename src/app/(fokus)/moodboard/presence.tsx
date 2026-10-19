"use client";

import type { MoodPresence, MoodRect } from "@/lib/moodboard";
import { MOOD_BOARDS } from "@/lib/moodboard";
import { cx } from "@/components/kit";

type View = { pan: { x: number; y: number }; zoom: number };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("") || "?";

const firstName = (name: string) => name.split(/\s+/)[0] || name;
const boardName = (id: string) => MOOD_BOARDS.find((b) => b.id === id)?.name ?? id;

/**
 * Kursor anggota lain di papan yang sama. Digambar di koordinat layar supaya ukurannya tetap,
 * dan bergerak halus karena kursor dikirim paling cepat tiap 50 ms.
 */
export function Cursors({ peers, view }: { peers: MoodPresence[]; view: View }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {peers.map((p) =>
        p.cursor ? (
          <div
            key={p.clientId}
            className="absolute left-0 top-0 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${view.pan.x + p.cursor.x * view.zoom}px, ${view.pan.y + p.cursor.y * view.zoom}px)` }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20" className="block">
              <path d="M1.5 1.5 L16 10.2 L9.4 11.6 L6 18.2 Z" fill={p.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="ml-3.5 mt-[-2px] block whitespace-nowrap rounded-md px-1.5 py-[2px] text-[11px] font-bold text-white" style={{ background: p.color }}>
              {firstName(p.name)}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Garis warna di elemen yang sedang dipilih anggota lain, supaya tidak mengedit hal yang sama tanpa sadar. */
export function PeerSelections({ peers, box, view }: { peers: MoodPresence[]; box: (id: string) => MoodRect | null; view: View }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {peers.flatMap((p) =>
        p.sel.slice(0, 40).map((id, i) => {
          const r = box(id);
          if (!r) return null;
          return (
            <div
              key={`${p.clientId}:${id}`}
              className="absolute rounded-[10px] border-2"
              style={{
                left: view.pan.x + r.x * view.zoom - 5,
                top: view.pan.y + r.y * view.zoom - 5,
                width: r.w * view.zoom + 10,
                height: r.h * view.zoom + 10,
                borderColor: p.color,
              }}
            >
              {i === 0 && (
                <span className="absolute -top-[22px] left-0 whitespace-nowrap rounded-md px-1.5 py-[2px] text-[11px] font-bold text-white" style={{ background: p.color }}>
                  {firstName(p.name)}
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

/**
 * Anggota yang sedang membuka moodboard. Satu orang bisa membuka beberapa tab; yang ditampilkan
 * satu avatar per orang, memakai tab yang terakhir bergerak. Klik avatar untuk mengikuti layarnya.
 */
export function PeerAvatars({ peers, following, onFollow }: { peers: MoodPresence[]; following: string | null; onFollow: (clientId: string | null) => void }) {
  const byUser = new Map<string, MoodPresence>();
  for (const p of peers) if (!byUser.has(p.userId) || byUser.get(p.userId)!.t < p.t) byUser.set(p.userId, p);
  const list = [...byUser.values()];
  if (!list.length) return null;
  const shown = list.slice(0, 5);
  return (
    <div role="group" aria-label="Anggota yang sedang membuka moodboard" className="flex items-center">
      {shown.map((p) => {
        const on = following !== null && peers.find((x) => x.clientId === following)?.userId === p.userId;
        return (
          <button
            key={p.userId}
            type="button"
            aria-pressed={on}
            aria-label={`${on ? "Berhenti mengikuti" : "Ikuti layar"} ${p.name}, sedang di papan ${boardName(p.board)}`}
            title={`${p.name}, di papan ${boardName(p.board)}. ${on ? "Klik untuk berhenti mengikuti." : "Klik untuk mengikuti layarnya."}`}
            onClick={() => onFollow(on ? null : p.clientId)}
            className="-ml-1.5 flex size-11 items-center justify-center rounded-full first:ml-0"
          >
            <span
              className={cx("flex size-8 items-center justify-center rounded-full text-[12px] font-extrabold text-white ring-2", on ? "ring-ink" : "ring-surface")}
              style={{ background: p.color }}
            >
              {initials(p.name)}
            </span>
          </button>
        );
      })}
      {list.length > shown.length && <span className="ml-1 text-[12px] font-bold text-muted">+{list.length - shown.length}</span>}
    </div>
  );
}

export { firstName };
