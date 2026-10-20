"use client";

import { useState, useTransition } from "react";
import { saveRole, setMemberPerms } from "@/actions/anggota";
import { AREAS, LEVEL_LABEL, levelWithin, NO_PERMS, type Perms, type RoleDef } from "@/lib/roles";
import { Feedback, Modal, type ActionResult } from "@/components/forms";
import { Button, buttonClass, cx, Field, Input, Status } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { DialogFooter } from "@/components/ui/dialog";

/**
 * Daftar halaman dengan pilihan Tidak ada, Lihat, atau Ubah. Tingkat yang lebih tinggi dari akses
 * pengelola sendiri dimatikan (server juga menolaknya). `base` menandai halaman yang berbeda dari peran.
 */
export function PermsGrid({ value, onChange, max, base }: { value: Perms; onChange: (p: Perms) => void; max: Perms; base?: Perms }) {
  return (
    <div className="flex flex-col">
      {AREAS.map((a) => {
        const changed = base && base[a.id] !== value[a.id];
        return (
          <div key={a.id} role="group" aria-labelledby={`area-${a.id}`} className="flex flex-col gap-2 border-b border-ground py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p id={`area-${a.id}`} className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
                {a.name}
                {changed && <Status tone="info">Berbeda dari peran</Status>}
              </p>
              <p className="text-[12px] leading-[1.5] text-muted">{a.help}</p>
            </div>
            <div className="flex shrink-0 gap-0.5 self-start rounded-xl bg-ground p-1 sm:self-auto">
              {a.levels.map((lv) => {
                const on = value[a.id] === lv;
                const allowed = levelWithin(lv, max[a.id]);
                return (
                  <button
                    key={lv}
                    type="button"
                    aria-pressed={on}
                    disabled={!allowed}
                    title={allowed ? undefined : "Lebih tinggi dari aksesmu sendiri"}
                    onClick={() => onChange({ ...value, [a.id]: lv })}
                    className={cx(
                      "h-9 whitespace-nowrap rounded-[10px] px-3 text-[12px] font-bold transition-colors duration-150",
                      on ? "bg-ink text-white" : "hover:bg-surface disabled:text-[#8d8c9e] disabled:hover:bg-transparent",
                    )}
                  >
                    {LEVEL_LABEL[lv]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useAction() {
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (r.ok) onOk?.();
    });
  return { state, setState, pending, run };
}

/** Akses khusus satu anggota, di atas izin perannya. */
export function MemberAccess({
  memberId,
  name,
  role,
  perms,
  max,
  custom,
}: {
  memberId: string;
  name: string;
  role: RoleDef;
  perms: Perms;
  max: Perms;
  custom: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(perms);
  const { state, setState, pending, run } = useAction();
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(perms);
          setState(null);
          setOpen(true);
        }}
        className={buttonClass("ground", "sm")}
      >
        Atur akses
      </button>
      <Modal
        open={open}
        onClose={close}
        wide
        title={`Akses ${name}`}
        description={`Peran ${role.name}. Halaman yang diubah di sini hanya berlaku untuk ${name}; halaman lain tetap mengikuti perannya.`}
      >
        <div className="max-h-[60dvh] overflow-y-auto pr-1">
          <PermsGrid value={value} onChange={setValue} max={max} base={role.perms} />
        </div>
        {state && !state.ok && <Feedback state={state} />}
        <DialogFooter>
          {custom && (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => setMemberPerms(memberId, null), close)}>
              Kembali ikut peran
            </Button>
          )}
          <Button variant="ground" onClick={close}>
            Batal
          </Button>
          <Button disabled={pending} onClick={() => run(() => setMemberPerms(memberId, value), close)}>
            {pending ? "Menyimpan…" : "Simpan akses"}
          </Button>
        </DialogFooter>
      </Modal>
    </>
  );
}

/**
 * Buat peran baru atau ubah izin peran yang ada. Peran baru bisa mulai dari salinan peran lain,
 * supaya tidak perlu mengisi semua halaman dari nol.
 */
export function RoleEditor({ role, roles, max, locked }: { role?: RoleDef; roles: RoleDef[]; max: Perms; locked?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [value, setValue] = useState<Perms>(role?.perms ?? { ...NO_PERMS, dashboard: "view" });
  const { state, setState, pending, run } = useAction();
  const close = () => setOpen(false);
  if (locked)
    return (
      <span className="text-[12px] text-muted" title={locked}>
        Peranmu sendiri
      </span>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(role?.name ?? "");
          setValue(role?.perms ?? { ...NO_PERMS, dashboard: "view" });
          setState(null);
          setOpen(true);
        }}
        className={buttonClass(role ? "ground" : "primary", role ? "sm" : "md")}
      >
        {role ? "Ubah" : "Buat peran"}
      </button>
      <Modal
        open={open}
        onClose={close}
        wide
        title={role ? `Ubah peran ${role.name}` : "Peran baru"}
        description={role ? "Berlaku untuk semua anggota dengan peran ini, kecuali halaman yang diatur khusus per anggota." : "Misalnya Tim dekor, Bendahara keluarga, atau Wedding organizer."}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama peran">
            <Input value={name} maxLength={40} placeholder="Misal: Tim dekor" onChange={(e) => setName(e.target.value)} />
          </Field>
          {!role && (
            <Field label="Mulai dari">
              <SelectField
                aria-label="Mulai dari peran"
                value=""
                onValueChange={(k) => {
                  const src = roles.find((r) => r.key === k);
                  // Salinan dibatasi akses pengelola sendiri, sama seperti di server.
                  if (src) setValue(Object.fromEntries(AREAS.map((a) => [a.id, levelWithin(src.perms[a.id], max[a.id]) ? src.perms[a.id] : "none"])) as Perms);
                }}
                options={[{ value: "", label: "Kosong" }, ...roles.map((r) => ({ value: r.key, label: `Salin ${r.name}` }))]}
              />
            </Field>
          )}
        </div>
        <div className="max-h-[52dvh] overflow-y-auto pr-1">
          <PermsGrid value={value} onChange={setValue} max={max} />
        </div>
        {state && !state.ok && <Feedback state={state} />}
        <DialogFooter>
          <Button variant="ground" onClick={close}>
            Batal
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveRole(role?.key ?? null, name, value), close)}>
            {pending ? "Menyimpan…" : role ? "Simpan peran" : "Buat peran"}
          </Button>
        </DialogFooter>
      </Modal>
    </>
  );
}

