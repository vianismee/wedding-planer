"use client";

import { useState, type DragEvent, type MouseEvent } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Frame,
  Image as ImageIcon,
  Link2,
  Lock,
  NotebookPen,
  Palette,
  PenLine,
  Slash,
  Square,
  SquareDashed,
  Type,
  Unlock,
} from "lucide-react";
import type { MoodData, MoodGroup, MoodNode } from "@/db/schema";
import { cleanParents, type MoodRect } from "@/lib/moodboard";
import { cx } from "@/components/kit";
import { insideRect } from "./board-view";

type Sel = { kind: "node" | "edge" | "group"; ids: string[] } | null;

const SHAPE_ICON = { rect: Square, ellipse: Circle, line: Slash, arrow: ArrowUpRight };
function NodeIcon({ n }: { n: MoodNode }) {
  const Icon =
    n.type === "photo"
      ? ImageIcon
      : n.type === "media"
        ? Link2
        : n.type === "note"
          ? NotebookPen
          : n.type === "palette"
            ? Palette
            : n.type === "text"
              ? Type
              : n.type === "draw"
                ? PenLine
                : n.type === "frame"
                  ? Frame
                  : SHAPE_ICON[n.shape ?? "rect"];
  return <Icon size={15} className="shrink-0 text-muted" aria-hidden="true" />;
}

/**
 * Section pemilik tiap elemen yang langsung di kanvas. Keanggotaan section mengikuti posisi (titik
 * tengah elemen di dalam kotak section), sama seperti saat section digeser. Bila section bertumpuk,
 * yang terkecil menang. Isi frame tidak dihitung: tempatnya di bawah frame-nya.
 */
export function groupOwners(d: MoodData, box: (n: MoodNode) => MoodRect) {
  const owner = new Map<string, string>();
  for (const n of cleanParents(d.nodes)) {
    if (n.parent) continue;
    let best: MoodGroup | undefined;
    for (const g of d.groups) if (insideRect(box(n), g) && (!best || g.w * g.h < best.w * best.h)) best = g;
    if (best) owner.set(n.id, best.id);
  }
  return owner;
}

export type LayerActions = {
  select: (kind: "node" | "group", id: string, additive: boolean) => void;
  rename: (kind: "node" | "group", id: string, title: string) => void;
  toggle: (kind: "node" | "group", id: string, key: "locked" | "hidden") => void;
  /** Taruh elemen `id` tepat di atas (`above`) atau di bawah elemen `target` dalam urutan lapisan. */
  reorder: (id: string, target: string, above: boolean) => void;
};

/**
 * Panel Layer di kiri: section seperti folder berisi elemen di dalamnya, frame berisi anaknya
 * (bisa bersarang), lalu elemen lepas.
 * Urutan dari atas ke bawah sama dengan tumpukan di kanvas (paling atas = paling depan).
 * Klik untuk memilih, Shift atau Ctrl untuk menambah, klik dua kali untuk mengganti nama,
 * seret untuk mengubah urutan, dan ikon mata dan gembok untuk menyembunyikan atau mengunci.
 */
export function LayersPanel({
  data,
  sel,
  owners,
  label,
  actions,
}: {
  data: MoodData;
  sel: Sel;
  owners: Map<string, string>;
  label: (n: MoodNode) => string;
  actions: LayerActions;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; above: boolean } | null>(null);

  const top = [...cleanParents(data.nodes)].reverse();
  const childrenOf = (id: string) => top.filter((n) => n.parent === id);
  const loose = top.filter((n) => !n.parent && !owners.has(n.id));
  const groups = [...data.groups].reverse();
  const isSel = (kind: "node" | "group", id: string) => sel?.kind === kind && sel.ids.includes(id);

  const toggleOpen = (id: string) =>
    setClosed((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function dropProps(n: MoodNode) {
    const half = (e: DragEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    };
    return {
      draggable: renaming !== n.id,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-mood-layer", n.id);
        setDragging(n.id);
      },
      onDragEnd: () => {
        setDragging(null);
        setDrop(null);
      },
      onDragOver: (e: DragEvent) => {
        if (!dragging || dragging === n.id) return;
        e.preventDefault();
        const above = half(e);
        if (drop?.id !== n.id || drop.above !== above) setDrop({ id: n.id, above });
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragging && dragging !== n.id) actions.reorder(dragging, n.id, half(e));
        setDragging(null);
        setDrop(null);
      },
    };
  }

  function row(kind: "node" | "group", item: MoodNode | MoodGroup, depth: number, extra?: React.ReactNode) {
    const on = isSel(kind, item.id);
    const name = kind === "node" ? label(item as MoodNode) : item.title || "Section";
    const click = (e: MouseEvent) => actions.select(kind, item.id, e.shiftKey || e.ctrlKey || e.metaKey);
    const line = drop?.id === item.id ? (drop.above ? "before:top-0" : "before:bottom-0") : null;
    return (
      <div
        key={item.id}
        {...(kind === "node" ? dropProps(item as MoodNode) : {})}
        className={cx(
          "group/row relative flex min-h-9 items-center gap-1 rounded-lg pr-1 text-[13px]",
          on ? "bg-ink text-white" : "hover:bg-ground",
          item.hidden && !on && "text-muted",
          dragging === item.id && "opacity-50",
          line && `before:pointer-events-none before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-ink ${line}`,
        )}
        style={{ paddingLeft: 6 + depth * 16 }}
      >
        {extra}
        {renaming === item.id ? (
          <input
            autoFocus
            aria-label="Nama layer"
            defaultValue={item.title}
            maxLength={kind === "node" ? 120 : 80}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(null);
            }}
            onBlur={(e) => {
              if (renaming === item.id) actions.rename(kind, item.id, e.currentTarget.value.trim());
              setRenaming(null);
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-ink bg-surface px-1.5 text-[13px] font-semibold text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            aria-pressed={on}
            onClick={click}
            onDoubleClick={() => setRenaming(item.id)}
            onKeyDown={(e) => {
              if (e.key === "F2") setRenaming(item.id);
            }}
            title="Klik dua kali atau F2 untuk mengganti nama"
            className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left font-semibold focus-visible:outline-none"
          >
            {kind === "node" ? <NodeIcon n={item as MoodNode} /> : <SquareDashed size={15} className={cx("shrink-0", on ? "text-white" : "text-muted")} aria-hidden="true" />}
            <span className="truncate">{name}</span>
          </button>
        )}
        {/* Ikon tetap terlihat saat aktif, supaya layer yang terkunci atau tersembunyi mudah ditemukan. */}
        {(["locked", "hidden"] as const).map((k) => {
          const active = !!item[k];
          const Icon = k === "locked" ? (active ? Lock : Unlock) : active ? EyeOff : Eye;
          const text = k === "locked" ? (active ? "Buka kunci" : "Kunci") : active ? "Tampilkan" : "Sembunyikan";
          return (
            <button
              key={k}
              type="button"
              aria-label={`${text} ${name}`}
              aria-pressed={active}
              title={text}
              onClick={() => actions.toggle(kind, item.id, k)}
              className={cx(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-opacity duration-150",
                on ? "hover:bg-white/15" : "hover:bg-[#e8e7ef]",
                active ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100",
              )}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  }

  function chevron(id: string, name: string, count: number, on: boolean) {
    const open = !closed.has(id);
    return (
      <button
        type="button"
        aria-label={open ? `Tutup ${name}` : `Buka ${name}`}
        aria-expanded={open}
        disabled={!count}
        onClick={() => toggleOpen(id)}
        className={cx("-ml-1 flex size-7 shrink-0 items-center justify-center rounded-md disabled:invisible", on ? "hover:bg-white/15" : "hover:bg-[#e8e7ef]")}
      >
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
      </button>
    );
  }

  /** Baris elemen, dan bila frame yang terbuka, baris anak-anaknya di bawahnya. */
  function nodeTree(n: MoodNode, depth: number): React.ReactNode[] {
    if (n.type !== "frame") return [row("node", n, depth)];
    const kids = childrenOf(n.id);
    return [
      row("node", n, depth, chevron(n.id, n.title || "frame", kids.length, isSel("node", n.id))),
      ...(closed.has(n.id) ? [] : kids.flatMap((c) => nodeTree(c, depth + 1))),
    ];
  }

  if (!data.nodes.length && !data.groups.length)
    return <p className="px-2 text-[13px] leading-[1.5] text-muted">Belum ada layer. Elemen yang ditaruh di kanvas muncul di sini, yang paling depan di paling atas.</p>;

  return (
    <div className="flex flex-col gap-px">
      {groups.map((g) => {
        const kids = top.filter((n) => !n.parent && owners.get(n.id) === g.id);
        return (
          <div key={g.id} className="flex flex-col gap-px">
            {row("group", g, 0, chevron(g.id, g.title || "section", kids.length, isSel("group", g.id)))}
            {!closed.has(g.id) && kids.flatMap((n) => nodeTree(n, 1))}
          </div>
        );
      })}
      {loose.length > 0 && groups.length > 0 && <div className="mx-2 my-1.5 h-px bg-line" aria-hidden="true" />}
      {loose.flatMap((n) => nodeTree(n, 0))}
    </div>
  );
}
