"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, LayoutTemplate } from "lucide-react";
import { addEventsFromTemplate, applyRundownTemplate } from "@/actions/acara";
import { Feedback, Modal, type ActionResult } from "@/components/forms";
import { SelectField } from "@/components/select-field";
import { useConfirm } from "@/components/confirm";
import { Button, Status, cx } from "@/components/kit";
import { addDays, dateShort, time } from "@/lib/format";
import { TEMPLATES, rundownTemplates, templateEvents, type AdatTemplateId } from "@/lib/templates";

type EventRef = { id: string; name: string; kind: string; rundownCount: number };

export function TemplateDialog({
  akadDate,
  defaultAdat,
  events,
  selectedEventId,
}: {
  akadDate: string;
  defaultAdat: AdatTemplateId;
  events: EventRef[];
  selectedEventId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"acara" | "rundown">("acara");
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
      >
        <LayoutTemplate size={16} aria-hidden="true" />
        Dari template
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="Tambah dari template"
        description="Kembalikan acara yang terhapus, atau isi rundown dari template adat. Semua hasilnya tetap bisa diedit."
      >
        <div role="group" aria-label="Jenis template" className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1">
          {(
            [
              ["acara", "Rangkaian acara"],
              ["rundown", "Rundown saja"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={tab === v}
              onClick={() => {
                setTab(v);
                setResult(null);
              }}
              className={cx("h-10 rounded-[10px] text-[13px] font-bold transition-colors duration-150", tab === v ? "bg-ink text-white" : "text-ink hover:bg-surface")}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "acara" ? (
          <EventTemplates
            akadDate={akadDate}
            defaultAdat={defaultAdat}
            existing={events.map((e) => e.name.toLowerCase())}
            onDone={(r) => {
              setResult(r);
              if (r.ok) setOpen(false);
            }}
          />
        ) : (
          <RundownTemplates
            events={events}
            selectedEventId={selectedEventId}
            onDone={(r) => {
              setResult(r);
              if (r.ok) setOpen(false);
            }}
          />
        )}
        {result && !result.ok && <Feedback state={result} />}
      </Modal>
      {result?.ok && !open && (
        <div className="fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 max-w-[360px] min-[900px]:bottom-6">
          <button type="button" onClick={() => setResult(null)} className="block w-full text-left" aria-label="Tutup pesan">
            <Feedback state={result} />
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Mode 1: rangkaian acara ---------- */

function EventTemplates({
  akadDate,
  defaultAdat,
  existing,
  onDone,
}: {
  akadDate: string;
  defaultAdat: AdatTemplateId;
  existing: string[];
  onDone: (r: ActionResult) => void;
}) {
  const [adat, setAdat] = useState<AdatTemplateId>(defaultAdat);
  const list = useMemo(() => templateEvents(adat), [adat]);
  const isExisting = (name: string) => existing.includes(name.toLowerCase());
  // Akad + resepsi terpisah dan versi gabungannya saling menggantikan, jadi yang satu menandai yang lain sudah tercakup.
  const has = (n: string) => existing.includes(n);
  const isCovered = (name: string) => {
    const n = name.toLowerCase();
    if (n === "akad nikah dan resepsi") return has("akad nikah") || has("resepsi");
    if (n === "akad nikah" || n === "resepsi") return has("akad nikah dan resepsi");
    return false;
  };
  const autoPick = (tpl: AdatTemplateId) => templateEvents(tpl).filter((e) => !isExisting(e.name) && !isCovered(e.name)).map((e) => e.name);
  // Bawaan: centang acara yang belum ada (misalnya yang terhapus).
  const [picked, setPicked] = useState<string[]>(() => autoPick(defaultAdat));
  const [withRundown, setWithRundown] = useState(true);
  const [pending, start] = useTransition();

  const changeAdat = (a: AdatTemplateId) => {
    setAdat(a);
    setPicked(autoPick(a));
  };
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-muted">Template adat</span>
        <div role="group" aria-label="Template adat" className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={adat === t.id}
              onClick={() => changeAdat(t.id as AdatTemplateId)}
              className={cx(
                "flex h-11 items-center gap-2 rounded-xl border-2 px-3.5 text-[13px] font-bold transition-colors duration-150",
                adat === t.id ? "border-ink bg-surface" : "border-transparent bg-ground",
              )}
            >
              {t.name}
              {adat === t.id && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px]">Dipilih</span>}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12px] font-semibold text-muted">Pilih acara</legend>
        <ul className="flex flex-col gap-1.5">
          {list.map((e) => {
            const on = picked.includes(e.name);
            const ex = isExisting(e.name);
            return (
              <li key={e.name}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(e.name)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-[14px] border-2 px-3 py-2.5 text-left transition-colors duration-150",
                    on ? "border-ink bg-surface" : "border-transparent bg-sunken hover:bg-ground",
                  )}
                >
                  <span className={cx("flex size-[22px] shrink-0 items-center justify-center rounded-md border-2", on ? "border-ink bg-ink text-white" : "border-outline bg-surface")}>
                    {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{e.name}</span>
                    <span className="block text-[12px] text-muted">
                      {dateShort(addDays(akadDate, e.offset))}, {time(e.time)} WIB, {e.location}
                    </span>
                  </span>
                  {e.rundown?.length ? <Status tone="neutral">{e.rundown.length} sesi rundown</Status> : null}
                  {ex && <Status tone="info">Sudah ada</Status>}
                  {!ex && isCovered(e.name) && <Status tone="info">Sudah tercakup</Status>}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <label className="flex items-center gap-3 text-[14px] font-semibold">
        <input type="checkbox" checked={withRundown} onChange={(e) => setWithRundown(e.target.checked)} className="size-5 accent-[#1C1B29]" />
        Sertakan rundown bawaan
      </label>
      {picked.some(isExisting) && (
        <p className="text-[12px] font-semibold text-warn-fg">Acara bertanda &quot;Sudah ada&quot; akan ditambahkan sebagai acara baru, tidak menimpa yang lama.</p>
      )}

      <div className="flex justify-end">
        <Button
          disabled={pending || picked.length === 0}
          onClick={() =>
            start(async () => {
              onDone(await addEventsFromTemplate(adat, picked, withRundown));
            })
          }
        >
          {pending ? "Menambahkan…" : `Tambah ${picked.length} acara`}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Mode 2: rundown saja ---------- */

function RundownTemplates({
  events,
  selectedEventId,
  onDone,
}: {
  events: EventRef[];
  selectedEventId?: string;
  onDone: (r: ActionResult) => void;
}) {
  const templates = useMemo(() => rundownTemplates(), []);
  const [eventId, setEventId] = useState(selectedEventId ?? events[0]?.id ?? "");
  const target = events.find((e) => e.id === eventId);
  // Template yang jenisnya cocok dengan acara tujuan tampil lebih dulu.
  const sorted = useMemo(
    () => [...templates].sort((a, b) => Number(b.kind === target?.kind) - Number(a.kind === target?.kind)),
    [templates, target?.kind],
  );
  const [tplId, setTplId] = useState(sorted[0]?.id ?? "");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  const tpl = templates.find((t) => t.id === tplId);

  if (events.length === 0)
    return <p className="rounded-[14px] bg-sunken p-4 text-[13px] text-muted">Belum ada acara. Tambahkan acara dulu, atau pakai tab Rangkaian acara.</p>;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-muted">Acara tujuan</span>
        <SelectField
          value={eventId}
          onValueChange={setEventId}
          aria-label="Acara tujuan"
          options={events.map((e) => ({ value: e.id, label: `${e.name}${e.rundownCount ? ` (${e.rundownCount} sesi)` : " (rundown kosong)"}` }))}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12px] font-semibold text-muted">Template rundown</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sorted.map((t) => {
            const on = t.id === tplId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTplId(t.id)}
                className={cx(
                  "flex flex-col gap-1 rounded-[14px] border-2 p-3 text-left transition-colors duration-150",
                  on ? "border-ink bg-surface" : "border-transparent bg-sunken hover:bg-ground",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-[13px] font-bold">
                  {t.name}
                  {on && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px]">Dipilih</span>}
                </span>
                <span className="text-[12px] text-muted">
                  {t.items.length} sesi, mulai {time(t.items[0][0])}
                  {target && t.kind === target.kind ? ", cocok dengan acara ini" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {tpl && (
        <section aria-label="Pratinjau rundown" className="rounded-[14px] bg-sunken p-3.5">
          <h3 className="mb-1.5 text-[12px] font-semibold text-muted">Pratinjau</h3>
          <ol className="flex flex-col gap-1 text-[13px]">
            {tpl.items.map(([t, a, pic], i) => (
              <li key={i} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
                <span className="font-extrabold tabular">{time(t)}</span>
                <span>
                  {a}
                  <span className="text-muted">, PIC {pic}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-muted">Rundown yang sudah ada</span>
        <div role="group" aria-label="Cara menerapkan" className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1">
          {(
            [
              ["append", "Tambahkan ke yang ada"],
              ["replace", "Ganti yang ada"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={mode === v}
              onClick={() => setMode(v)}
              className={cx("h-10 rounded-[10px] text-[13px] font-bold transition-colors duration-150", mode === v ? "bg-ink text-white" : "text-ink hover:bg-surface")}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted">
          {mode === "append" ? "Sesi dari template digabung dan diurutkan berdasarkan jam." : `${target?.rundownCount ?? 0} sesi lama akan dihapus dan diganti template.`}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={pending || !tpl || !target}
          onClick={async () => {
            if (mode === "replace" && target && target.rundownCount > 0) {
              const yes = await dialogs.confirm({
                title: `Ganti rundown ${target.name}?`,
                description: `${target.rundownCount} sesi yang ada akan dihapus dan diganti ${tpl!.items.length} sesi dari template.`,
                confirmLabel: "Ganti rundown",
                destructive: true,
              });
              if (!yes) return;
            }
            start(async () => onDone(await applyRundownTemplate(eventId, tplId, mode)));
          }}
        >
          {pending ? "Menerapkan…" : "Terapkan rundown"}
        </Button>
      </div>
    </div>
  );
}
