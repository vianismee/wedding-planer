import type { Metadata } from "next";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { MAX_MEMBERS, ROLE_HELP, ROLE_LABEL, type Role } from "@/lib/roles";
import { ACCENTS, RELIGIONS, templateName } from "@/lib/templates";
import { dateShort } from "@/lib/format";
import { updateWedding } from "@/actions/wedding";
import { createInvite, removeMember, revokeInvite, updateProfile } from "@/actions/anggota";
import { ActionButton, ActionForm } from "@/components/forms";
import { Avatar, Card, Field, Input, LinkButton, PageHeader, SectionTitle, Status } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { CopyLink } from "@/components/copy-link";
import { RoleSelect } from "./role-select";
import { DangerZone, WeddingSwitcher } from "./client";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  const ctx = await requirePage("pengaturan");
  const w = ctx.wedding;
  const [members, invites, myWeddings] = await Promise.all([
    db
      .select({ member: schema.member, name: schema.user.name, email: schema.user.email })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(eq(schema.member.weddingId, w.id))
      .orderBy(asc(schema.member.createdAt)),
    db
      .select()
      .from(schema.invite)
      .where(and(eq(schema.invite.weddingId, w.id), isNull(schema.invite.acceptedAt), gt(schema.invite.expiresAt, new Date()))),
    db
      .select({ id: schema.wedding.id, groom: schema.wedding.groomName, bride: schema.wedding.brideName })
      .from(schema.member)
      .innerJoin(schema.wedding, eq(schema.member.weddingId, schema.wedding.id))
      .where(eq(schema.member.userId, ctx.user.id)),
  ]);
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const seats = MAX_MEMBERS - members.length;

  return (
    <>
      <PageHeader title="Pengaturan" description="Data pernikahan, anggota keluarga, dan akun." />

      <div className="grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <SectionTitle>Ruang pernikahan</SectionTitle>
          <ActionForm action={updateWedding}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Calon pengantin pria">
                <Input name="groomName" required defaultValue={w.groomName} />
              </Field>
              <Field label="Calon pengantin wanita">
                <Input name="brideName" required defaultValue={w.brideName} />
              </Field>
              <Field label="Tanggal akad" hint="Tenggat checklist dan tanggal acara yang belum selesai ikut bergeser.">
                <DateField name="akadDate" defaultValue={w.akadDate} />
              </Field>
              <Field label="Kota">
                <Input name="city" required defaultValue={w.city} />
              </Field>
              <Field label="Agama" hint="Menentukan jalur KUA atau Dukcapil.">
                <SelectField name="religion" defaultValue={w.religion} options={[...RELIGIONS.map((r) => ({ value: r.id, label: r.name }))]} />
              </Field>
              <Field label="Kantor pencatatan">
                <Input name="officeName" defaultValue={w.officeName ?? ""} placeholder="Contoh: KUA Kecamatan Laweyan" />
              </Field>
              <Field label="Kuota tamu pihak pria (orang)">
                <Input type="number" min={0} name="quotaGroom" defaultValue={w.quotaGroom} />
              </Field>
              <Field label="Kuota tamu pihak wanita (orang)">
                <Input type="number" min={0} name="quotaBride" defaultValue={w.quotaBride} />
              </Field>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[12px] font-semibold text-muted">Warna aksen</legend>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => (
                  <label
                    key={a.id}
                    className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-transparent bg-ground px-3 text-[13px] font-semibold has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
                  >
                    <input type="radio" name="accent" value={a.id} defaultChecked={w.accent === a.id} className="sr-only" />
                    <span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: a.id }} aria-hidden="true" />
                    {a.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[12px] text-muted">
              Template adat: akad {templateName(w.akadTemplate)}, resepsi {templateName(w.resepsiTemplate)}. Isi acara, checklist, dan seserahan bisa
              diedit langsung di halamannya.
            </p>
          </ActionForm>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <SectionTitle aside={<Status tone={seats > 0 ? "neutral" : "warn"}>{members.length} dari {MAX_MEMBERS} anggota</Status>}>
              Anggota
            </SectionTitle>
            <ul className="flex flex-col">
              {members.map(({ member: m, name, email }) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-ground py-2.5 last:border-0">
                  <Avatar name={name || email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">
                      {name || email}
                      {m.userId === ctx.user.id && <span className="font-semibold text-muted"> (kamu)</span>}
                    </p>
                    <p className="truncate text-[12px] text-muted">{email}</p>
                  </div>
                  {m.role === "pemilik" ? (
                    <Status tone="info">Pemilik</Status>
                  ) : (
                    <>
                      <RoleSelect memberId={m.id} role={m.role} />
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        confirm={`Keluarkan ${name || email} dari pernikahan ini?`}
                        action={removeMember.bind(null, m.id)}
                      >
                        Keluarkan
                      </ActionButton>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Undang anggota</SectionTitle>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {(Object.keys(ROLE_HELP) as Exclude<Role, "pemilik">[]).map((r) => (
                <li key={r}>
                  <strong>{ROLE_LABEL[r]}</strong>: {ROLE_HELP[r]}
                </li>
              ))}
            </ul>
            {seats > 0 ? (
              <ActionForm action={createInvite} submitLabel="Buat undangan" resetOnSuccess>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Peran">
                    <SelectField name="role" defaultValue="keluarga" options={[{ value: "pasangan", label: "Pasangan" }, { value: "keluarga", label: "Keluarga" }, { value: "panitia", label: "Panitia" }]} />
                  </Field>
                  <Field label="Email (opsional)" hint="Kosongkan untuk membuat link yang dibagikan lewat WhatsApp.">
                    <Input type="email" name="email" />
                  </Field>
                </div>
              </ActionForm>
            ) : (
              <p className="text-[13px] font-semibold text-warn-fg">Sudah {MAX_MEMBERS} anggota. Keluarkan anggota lain untuk mengundang lagi.</p>
            )}
            {invites.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-ground pt-4">
                <h3 className="text-[14px] font-bold">Undangan menunggu</h3>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex flex-col gap-2 rounded-[14px] bg-sunken p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span>
                        <strong>{ROLE_LABEL[inv.role as Role]}</strong>
                        {inv.email ? ` untuk ${inv.email}` : ", link terbuka"}. Berlaku sampai {dateShort(inv.expiresAt.toISOString().slice(0, 10))}.
                      </span>
                      <ActionButton variant="ghost" size="sm" action={revokeInvite.bind(null, inv.id)}>
                        Batalkan
                      </ActionButton>
                    </div>
                    <CopyLink url={`${base}/undangan/${inv.token}`} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Akun kamu</SectionTitle>
            <ActionForm action={updateProfile} inlineSubmit submitVariant="ground">
              <Field label="Nama" className="min-w-[200px] flex-1">
                <Input name="name" required defaultValue={ctx.user.name} />
              </Field>
            </ActionForm>
            <p className="text-[13px] text-muted">Masuk dengan {ctx.user.email}.</p>
            <WeddingSwitcher current={w.id} weddings={myWeddings.map((x) => ({ id: x.id, name: `${x.groom} & ${x.bride}` }))} />
            <LinkButton href="/onboarding?baru=1" variant="ground" className="self-start">
              Buat ruang pernikahan lain
            </LinkButton>
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>Data dan privasi</SectionTitle>
            <p className="text-[13px] text-muted">
              Ekspor daftar tamu kapan saja. Pemilik bisa menghapus seluruh ruang pernikahan, termasuk scan dokumen, secara permanen.
            </p>
            <a href="/api/export/tamu" className="text-[13px] font-semibold underline">
              Unduh daftar tamu (CSV)
            </a>
            {ctx.member.role === "pemilik" && <DangerZone confirmText={`${w.groomName} & ${w.brideName}`} />}
          </Card>
        </div>
      </div>
    </>
  );
}
