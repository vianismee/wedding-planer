"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWedding } from "@/actions/wedding";
import { Button, Field, Input, cx } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { RELIGIONS, TEMPLATES, templateName } from "@/lib/templates";
import { dateLong, diffDays, todayISO } from "@/lib/format";

type Data = {
  userName: string;
  groomName: string;
  brideName: string;
  akadDate: string;
  city: string;
  akadTemplate: string;
  resepsiTemplate: string;
  religion: string;
  budget: string;
};

const STEPS = ["Pasangan", "Tanggal", "Template", "Selesai"];

export function Wizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [empty, setEmpty] = useState(false);
  const [sameDay, setSameDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Data>({
    userName: defaultName,
    groomName: "",
    brideName: "",
    akadDate: "",
    city: "",
    akadTemplate: "jawa",
    resepsiTemplate: "jawa",
    religion: "islam",
    budget: "",
  });
  const set = (k: keyof Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === 1 && !d.akadDate) return setError("Pilih tanggal akad dulu.");
    if (step === 1 && d.akadDate && diffDays(todayISO(), d.akadDate) < 0) {
      return setError(
        "Tanggal akad sudah lewat. Pilih tanggal yang akan datang.",
      );
    }
    if (step < 3) return setStep(step + 1);
    submit();
  }

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => fd.set(k, v));
    fd.set("sameDay", sameDay && !empty ? "1" : "");
    if (empty) {
      fd.set("akadTemplate", "kosong");
      fd.set("resepsiTemplate", "kosong");
      fd.set("budget", "");
    }
    const r = await createWedding(fd);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push("/dashboard");
    router.refresh();
  }

  const days = d.akadDate ? diffDays(todayISO(), d.akadDate) : null;

  return (
    <form
      onSubmit={next}
      className="flex w-full max-w-[560px] flex-col gap-6 rounded-[24px] bg-surface p-6 sm:p-8"
    >
      <ol className="flex gap-2" aria-label="Langkah">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="flex flex-1 flex-col gap-1.5"
            aria-current={i === step ? "step" : undefined}
          >
            <span
              className={cx(
                "h-1.5 rounded-full",
                i <= step ? "bg-ink" : "bg-ground",
              )}
            />
            <span
              className={cx(
                "text-[12px] font-semibold",
                i === step ? "text-ink" : "text-muted",
              )}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Heading
            title="Siapa yang menikah?"
            sub="Nama ini muncul di dashboard dan rundown untuk keluarga."
          />
          <Field label="Nama kamu">
            <Input
              required
              value={d.userName}
              onChange={set("userName")}
              autoComplete="name"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Calon pengantin pria">
              <Input
                required
                value={d.groomName}
                onChange={set("groomName")}
                placeholder="Nama panggilan"
              />
            </Field>
            <Field label="Calon pengantin wanita">
              <Input
                required
                value={d.brideName}
                onChange={set("brideName")}
                placeholder="Nama panggilan"
              />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Heading
            title="Kapan dan di mana akadnya?"
            sub="Checklist disusun mundur dari tanggal ini. Bisa diubah kapan saja."
          />
          <Field
            label="Tanggal akad nikah"
            hint={
              days !== null && days >= 0
                ? `${dateLong(d.akadDate)}, ${days} hari lagi`
                : undefined
            }
          >
            <DateField
              min={todayISO()}
              value={d.akadDate}
              onChange={(v) => setD((p) => ({ ...p, akadDate: v }))}
            />
          </Field>
          <Field label="Kota">
            <Input
              required
              value={d.city}
              onChange={set("city")}
              placeholder="Contoh: Surakarta"
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Heading
            title="Mulai dari mana?"
            sub="Template mengisi acara, checklist, dan seserahan sesuai adat. Atau mulai kosong dan isi sendiri."
          />
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Cara memulai</legend>
            {(
              [
                [
                  false,
                  "Pakai template adat",
                  "Acara, rundown, checklist, seserahan, dan dokumen langsung tersusun.",
                ],
                [
                  true,
                  "Mulai kosong",
                  "Tanpa isi bawaan. Acara, tugas, dan budget kamu tambahkan sendiri.",
                ],
              ] as [boolean, string, string][]
            ).map(([val, title, desc]) => (
              <label
                key={title}
                className={cx(
                  "flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                  empty === val
                    ? "border-ink bg-surface"
                    : "border-transparent bg-ground",
                )}
              >
                <input
                  type="radio"
                  name="mulai"
                  checked={empty === val}
                  onChange={() => setEmpty(val)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2 text-[14px] font-bold">
                  {title}
                  {empty === val && (
                    <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px]">
                      Dipilih
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-muted">{desc}</span>
              </label>
            ))}
          </fieldset>
          {!empty && (
            <>
              <TemplatePicker
                label="Template akad"
                name="akad"
                value={d.akadTemplate}
                onChange={(v) => setD((p) => ({ ...p, akadTemplate: v }))}
              />
              <TemplatePicker
                label="Template resepsi"
                name="resepsi"
                value={d.resepsiTemplate}
                onChange={(v) => setD((p) => ({ ...p, resepsiTemplate: v }))}
              />
              <label className="flex items-start gap-3 rounded-xl bg-sunken p-3.5 text-[13px]">
                <input type="checkbox" checked={sameDay} onChange={(e) => setSameDay(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#1C1B29]" />
                <span>
                  <span className="block font-bold">Akad dan resepsi di hari yang sama</span>
                  <span className="block text-muted">Dibuat satu acara dengan rundown gabungan: akad di pagi hari, jeda ganti busana, lalu resepsi.</span>
                </span>
              </label>
            </>
          )}
          <Field
            label="Agama"
            hint="Menentukan jalur pencatatan: KUA untuk Islam, Dukcapil untuk agama lain."
          >
            <SelectField
              value={d.religion}
              onValueChange={(v) => setD((p) => ({ ...p, religion: v }))}
              options={[
                ...RELIGIONS.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Heading
            title="Hampir selesai"
            sub={
              empty
                ? "Ruang pernikahan dibuat kosong. Kamu bisa langsung menambah acara, tamu, budget, dan jadwal."
                : "Kami siapkan rangkaian acara, checklist, seserahan, dan dokumen dari pilihanmu."
            }
          />
          <dl className="grid grid-cols-1 gap-3 rounded-[18px] bg-sunken p-4 text-[13px] sm:grid-cols-2">
            <Row label="Pasangan">
              {d.groomName} dan {d.brideName}
            </Row>
            <Row label="Akad">{dateLong(d.akadDate)}</Row>
            <Row label="Kota">{d.city}</Row>
            <Row label="Adat">
              {empty
                ? "Tanpa template"
                : `Akad ${templateName(d.akadTemplate)}, resepsi ${templateName(d.resepsiTemplate)}${sameDay ? ", di hari yang sama" : ""}`}
            </Row>
          </dl>
          {!empty && (
            <Field
              label="Perkiraan total budget (opsional)"
              hint="Dibagi otomatis ke kategori. Bisa diubah di halaman Budget."
            >
              <Input
                inputMode="numeric"
                value={d.budget}
                onChange={set("budget")}
                placeholder="Contoh: 150.000.000 atau 150jt"
              />
            </Field>
          )}
        </div>
      )}

      {error && (
        <Alert variant="warn">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2">
        {step > 0 ? (
          <Button variant="ground" onClick={() => setStep(step - 1)}>
            Kembali
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          {step < 3 ? "Lanjut" : busy ? "Menyiapkan…" : "Buat ruang pernikahan"}
        </Button>
      </div>
    </form>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">
        {title}
      </h1>
      <p className="text-[14px] text-muted">{sub}</p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function TemplatePicker({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-muted">
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => {
          const on = value === t.id;
          return (
            <label
              key={t.id}
              className={cx(
                "flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                on ? "border-ink bg-surface" : "border-transparent bg-ground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={t.id}
                checked={on}
                onChange={() => onChange(t.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2 text-[13px] font-bold">
                {t.name}
                {on && (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px]">
                    Dipilih
                  </span>
                )}
              </span>
              <span className="text-[12px] text-muted">{t.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
