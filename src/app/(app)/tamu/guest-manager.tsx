"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useDeferredValue, useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { addGuest, deleteGuest, setGuestsStatus, updateGuest } from "@/actions/tamu";
import { Modal, type ActionResult, submitWith } from "@/components/forms";
import { useConfirm } from "@/components/confirm";
import { Button, Field, Input, Status, cx } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { CreatableSelect } from "@/components/creatable-select";
import { DELIVERY, GUEST_CATEGORIES, GUEST_STATUS } from "@/lib/templates";
import { number } from "@/lib/format";
import { ImportDialog } from "./import-dialog";

export type GuestRow = {
  id: string;
  name: string;
  note: string | null;
  category: string;
  side: string;
  session: string;
  pax: number;
  delivery: string;
  status: string;
  vip: boolean;
};

const PAGE = 100;
const deliveryName = (id: string) => DELIVERY.find((d) => d.id === id)?.name ?? id;
const statusOf = (id: string) => GUEST_STATUS.find((s) => s.id === id) ?? GUEST_STATUS[0];

export function GuestManager({ guests }: { guests: GuestRow[] }) {
  const [cat, setCat] = useState("Semua");
  const [side, setSide] = useState("");
  const [session, setSession] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<GuestRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  const q = useDeferredValue(query);

  // Indeks pencarian dibuat sekali; filter berjalan di memori sehingga 1.500+ tamu tetap di bawah 300 ms.
  const indexed = useMemo(
    () => guests.map((g) => ({ g, key: `${g.name} ${g.note ?? ""}`.toLowerCase() })),
    [guests],
  );
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) m.set(g.category, (m.get(g.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [guests]);
  const sessions = useMemo(() => [...new Set(guests.map((g) => g.session))].sort(), [guests]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return indexed
      .filter(
        ({ g, key }) =>
          (cat === "Semua" || g.category === cat) &&
          (!side || g.side === side) &&
          (!session || g.session === session) &&
          (!status || g.status === status) &&
          (!needle || key.includes(needle)),
      )
      .map((x) => x.g);
  }, [indexed, cat, side, session, status, q]);

  const shown = filtered.slice(0, limit);
  const filteredPax = filtered.reduce((s, g) => s + g.pax, 0);
  const existingNames = useMemo(() => new Set(guests.map((g) => g.name.trim().toLowerCase())), [guests]);

  const markSent = async () => {
    const ids = filtered.filter((g) => g.status !== "terkirim").map((g) => g.id);
    if (ids.length === 0) return;
    const yes = await dialogs.confirm({
      title: `Tandai ${ids.length} undangan sebagai terkirim?`,
      description: "Hanya undangan yang sedang tampil sesuai filter yang diubah.",
      confirmLabel: "Tandai terkirim",
    });
    if (!yes) return;
    start(async () => {
      const r = await setGuestsStatus(ids, "terkirim");
      if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-surface p-4 sm:p-5" aria-label="Daftar tamu">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" />
          Tambah tamu
        </Button>
        <Button variant="ground" onClick={() => setImporting(true)}>
          <FileSpreadsheet size={16} aria-hidden="true" />
          Import Excel atau CSV
        </Button>
        <label className="relative ml-auto flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
          <span className="sr-only">Cari tamu</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 text-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Cari nama atau keterangan"
            className="pl-10"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Filter kategori" className="flex flex-wrap gap-1 rounded-xl bg-ground p-1">
          {[["Semua", guests.length] as [string, number], ...categories].map(([c, n]) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => {
                setCat(c);
                setLimit(PAGE);
              }}
              className={cx(
                "hit-44 flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold transition-colors duration-150",
                cat === c ? "bg-ink text-white" : "text-ink hover:bg-surface",
              )}
            >
              {c}
              <span className={cx("text-[12px] font-semibold", cat === c ? "text-[#c9c8d6]" : "text-muted")}>{number(n)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectField aria-label="Filter pihak" value={side} onValueChange={(v) => setSide(v)} className="h-10 w-auto!" options={[{ value: "", label: "Semua pihak" }, { value: "pria", label: "Pihak pria" }, { value: "wanita", label: "Pihak wanita" }]} />
          <SelectField aria-label="Filter sesi" value={session} onValueChange={(v) => setSession(v)} className="h-10 w-auto!" options={[{ value: "", label: "Semua sesi" }, ...sessions.map((s) => ({ value: s, label: s }))]} />
          <SelectField aria-label="Filter status" value={status} onValueChange={(v) => setStatus(v)} className="h-10 w-auto!" options={[{ value: "", label: "Semua status" }, ...GUEST_STATUS.map((s) => ({ value: s.id, label: s.name }))]} />
          {filtered.some((g) => g.status !== "terkirim") && (
            <Button variant="ghost" size="sm" className="h-10" onClick={markSent} disabled={pending}>
              Tandai yang tampil sudah terkirim
            </Button>
          )}
        </div>
      </div>

      {guests.length === 0 ? (
        <div className="rounded-[18px] bg-sunken p-5">
          <p className="text-[14px] font-bold">Belum ada tamu.</p>
          <p className="text-[13px] text-muted">
            Tambahkan tamu satu per satu, atau import daftar dari Excel yang biasa dipegang orang tua.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[18px] bg-sunken p-5 text-[13px]">
          <p className="font-bold">Tidak ada tamu yang cocok.</p>
          <p className="text-muted">Ubah kata kunci atau filter untuk melihat tamu lain.</p>
        </div>
      ) : (
        <>
          {/* Tabel untuk layar lebar */}
          <div className="relative hidden overflow-x-auto min-[720px]:block">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] font-semibold text-muted">
                  {["Nama", "Kategori", "Pihak", "Sesi", "Orang", "Kirim via", "Status"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-line px-3 py-2.5">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id} className="border-b border-ground last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-bold">
                        {g.name}
                        {g.vip && <Status tone="info" className="ml-2">VIP</Status>}
                      </div>
                      {g.note && <div className="text-[12px] text-muted">{g.note}</div>}
                    </td>
                    <td className="px-3 py-2.5">{g.category}</td>
                    <td className="px-3 py-2.5">{g.side === "pria" ? "Pria" : "Wanita"}</td>
                    <td className="px-3 py-2.5">{g.session}</td>
                    <td className="px-3 py-2.5 font-bold tabular">{g.pax}</td>
                    <td className="px-3 py-2.5">{deliveryName(g.delivery)}</td>
                    <td className="px-3 py-2.5">
                      <Status tone={statusOf(g.status).tone}>{statusOf(g.status).name}</Status>
                    </td>
                    <td className="px-1 py-1 text-right">
                      <RowActions g={g} onEdit={() => setEditing(g)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu bertumpuk untuk HP */}
          <ul className="flex flex-col gap-2 min-[720px]:hidden">
            {shown.map((g) => (
              <li key={g.id} className="flex items-start gap-2 rounded-[18px] bg-sunken p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">
                    {g.name}
                    {g.vip && <Status tone="info" className="ml-2">VIP</Status>}
                  </div>
                  {g.note && <div className="text-[12px] text-muted">{g.note}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span>{g.category}</span>
                    <span>Pihak {g.side}</span>
                    <span>{g.session}</span>
                    <span className="font-bold">{g.pax} orang</span>
                  </div>
                  <div className="mt-2">
                    <Status tone={statusOf(g.status).tone}>{statusOf(g.status).name}</Status>
                  </div>
                </div>
                <RowActions g={g} onEdit={() => setEditing(g)} />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
            <span>
              Menampilkan {number(shown.length)} dari {number(filtered.length)} undangan, {number(filteredPax)} orang
            </span>
            {filtered.length > limit && (
              <Button variant="ground" size="sm" onClick={() => setLimit(limit + PAGE)}>
                Tampilkan {Math.min(PAGE, filtered.length - limit)} lagi
              </Button>
            )}
          </div>
        </>
      )}

      <GuestDialog
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        guest={editing}
        categories={[...new Set([...GUEST_CATEGORIES, ...categories.map(([c]) => c)])]}
        sessions={[...new Set(["Sesi 1", "Sesi 2", "Akad", ...sessions])]}
        onClose={() => setEditing(null)}
      />
      <ImportDialog open={importing} onClose={() => setImporting(false)} existingNames={existingNames} />
    </section>
  );
}

function RowActions({ g, onEdit }: { g: GuestRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  return (
    <span className="inline-flex">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Ubah ${g.name}`}
        className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-ground"
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label={`Hapus ${g.name}`}
        onClick={async () => {
          const yes = await dialogs.confirm({ title: `Hapus ${g.name} dari daftar tamu?`, confirmLabel: "Hapus", destructive: true });
          if (!yes) return;
          start(async () => {
            const r = await deleteGuest(g.id);
            if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
          });
        }}
        className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-ground disabled:opacity-50"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </span>
  );
}

function GuestDialog({
  guest,
  categories,
  sessions,
  onClose,
}: {
  guest: GuestRow | "new" | null;
  categories: string[];
  sessions: string[];
  onClose: () => void;
}) {
  const g = guest && guest !== "new" ? guest : null;
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = g ? await updateGuest(g.id, fd) : await addGuest(fd);
    if (r.ok) onClose();
    return r;
  }, null);

  return (
    <Modal open={guest !== null} onClose={onClose} title={g ? `Ubah ${g.name}` : "Tambah tamu"}>
      <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
        <Field label="Nama tamu">
          <Input name="name" required defaultValue={g?.name} placeholder="Contoh: Bpk. Sutrisno dan Ibu" />
        </Field>
        <Field label="Keterangan" hint="Hubungan atau kota, misalnya Pakde, Mojokerto.">
          <Input name="note" defaultValue={g?.note ?? ""} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kategori">
            <CreatableSelect name="category" options={categories} defaultValue={g?.category ?? "Keluarga"} createLabel="Tambah kategori" searchPlaceholder="Cari atau ketik kategori baru" />
          </Field>
          <Field label="Pihak">
            <SelectField name="side" defaultValue={g?.side ?? "wanita"} options={[{ value: "pria", label: "Pria" }, { value: "wanita", label: "Wanita" }]} />
          </Field>
          <Field label="Sesi">
            <CreatableSelect name="session" options={sessions} defaultValue={g?.session ?? "Sesi 1"} createLabel="Tambah sesi" searchPlaceholder="Cari atau ketik sesi baru" />
          </Field>
          <Field label="Jumlah orang">
            <Input name="pax" type="number" min={1} max={500} required defaultValue={g?.pax ?? 2} />
          </Field>
          <Field label="Kirim undangan via">
            <SelectField name="delivery" defaultValue={g?.delivery ?? "diantar"} options={[...DELIVERY.map((d) => ({ value: d.id, label: d.name }))]} />
          </Field>
          <Field label="Status">
            <SelectField name="status" defaultValue={g?.status ?? "belum_kirim"} options={[...GUEST_STATUS.map((s) => ({ value: s.id, label: s.name }))]} />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-[14px] font-semibold">
          <input type="checkbox" name="vip" defaultChecked={g?.vip} className="size-5 accent-[#1C1B29]" />
          Tamu VIP
        </label>
        {state && !state.ok && (
          <Alert variant="warn">
<AlertDescription>{state.error}</AlertDescription>
</Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ground" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
