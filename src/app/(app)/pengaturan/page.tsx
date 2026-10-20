import type { Metadata } from "next";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can, describePerms, isPreset, MAX_MEMBERS, PRESETS, resolvePerms, roleList, roleName, within } from "@/lib/roles";
import { ACCENTS, RELIGIONS, templateName } from "@/lib/templates";
import { dateShort } from "@/lib/format";
import { updateWedding } from "@/actions/wedding";
import { createInvite, deleteRole, removeMember, revokeInvite, setPassword, updateProfile } from "@/actions/anggota";
import { ActionButton, ActionForm } from "@/components/forms";
import { Avatar, Card, Field, Input, LinkButton, Meta, PageHeader, SectionTitle, Status } from "@/components/kit";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { CopyLink } from "@/components/copy-link";
import { RoleSelect } from "./role-select";
import { MemberAccess, RoleEditor } from "./access";
import { InstallApp } from "@/components/install-app";
import { DangerZone, WeddingSwitcher } from "./client";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  // Semua anggota boleh membuka halaman ini untuk akun pribadinya. Bagian pernikahan dan anggota
  // mengikuti izin Pengaturan pernikahan: Lihat untuk melihat, Ubah untuk mengubah.
  const ctx = await requirePage();
  const w = ctx.wedding;
  const see = can(ctx.perms, "pengaturan");
  const manage = can(ctx.perms, "pengaturan", "edit");
  const roles = roleList(ctx.roles);
  const roleOptions = roles.map((r) => ({ value: r.key, label: r.name }));
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
  const religion = RELIGIONS.find((r) => r.id === w.religion)?.name ?? w.religion;

  return (
    <>
      <PageHeader title="Pengaturan" description={see ? "Data pernikahan, anggota, akses, dan akun." : "Akun kamu."} />

      <div className="grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-2">
        {see && (
          <Card className="flex flex-col gap-4">
            <SectionTitle>Ruang pernikahan</SectionTitle>
            {!manage ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Meta label="Calon pengantin">{w.groomName} dan {w.brideName}</Meta>
                <Meta label="Tanggal akad">{dateShort(w.akadDate)}</Meta>
                <Meta label="Kota">{w.city}</Meta>
                <Meta label="Agama">{religion}</Meta>
                <Meta label="Kantor pencatatan">{w.officeName || "Belum diisi"}</Meta>
                <Meta label="Kuota tamu">
                  Pria {w.quotaGroom}, wanita {w.quotaBride}
                </Meta>
              </div>
            ) : (
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
            )}
          </Card>
        )}

        <div className="flex flex-col gap-6">
          {see && (
            <Card className="flex flex-col gap-4">
              <SectionTitle aside={<Status tone={seats > 0 ? "neutral" : "warn"}>{members.length} dari {MAX_MEMBERS} anggota</Status>}>
                Anggota
              </SectionTitle>
              <ul className="flex flex-col">
                {members.map(({ member: m, name, email }) => {
                  const perms = resolvePerms(m.role, m.perms, ctx.roles);
                  const role = roles.find((r) => r.key === m.role);
                  const label = name || email;
                  // Bisa diatur: bukan pemilik, bukan diri sendiri, dan aksesnya tidak melebihi akses pengelola.
                  const editable = manage && m.role !== "pemilik" && m.userId !== ctx.user.id && within(perms, ctx.perms);
                  return (
                    <li key={m.id} className="flex flex-col gap-2 border-b border-ground py-3 last:border-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Avatar name={label} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-bold">
                            {label}
                            {m.userId === ctx.user.id && <span className="font-semibold text-muted"> (kamu)</span>}
                          </p>
                          <p className="truncate text-[12px] text-muted">{email}</p>
                        </div>
                        {editable && role ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <RoleSelect memberId={m.id} role={m.role} options={roleOptions} />
                            <MemberAccess memberId={m.id} name={label} role={role} perms={perms} max={ctx.perms} custom={!!m.perms} />
                            <ActionButton variant="ghost" size="sm" confirm={`Keluarkan ${label} dari pernikahan ini?`} confirmLabel="Keluarkan" action={removeMember.bind(null, m.id)}>
                              Keluarkan
                            </ActionButton>
                          </div>
                        ) : (
                          <Status tone={m.role === "pemilik" ? "info" : "neutral"}>{roleName(m.role, ctx.roles)}</Status>
                        )}
                      </div>
                      <p className="text-[12px] leading-[1.5] text-muted sm:pl-12">
                        {m.perms && <strong className="font-bold text-ink">Akses khusus. </strong>}
                        {describePerms(perms)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {manage && <p className="text-[12px] text-muted">Akses pemilik dan aksesmu sendiri tidak bisa diubah di sini.</p>}
            </Card>
          )}

          {see && (
            <Card className="flex flex-col gap-4">
              <SectionTitle aside={manage ? <RoleEditor roles={roles} max={ctx.perms} /> : undefined}>Peran dan akses</SectionTitle>
              <p className="text-[13px] leading-[1.5] text-muted">
                Peran menentukan halaman yang bisa dilihat dan diubah. Mengubah peran berlaku untuk semua anggotanya. Akses satu orang bisa dibuat berbeda lewat Atur akses di daftar anggota.
              </p>
              <ul className="flex flex-col">
                {roles.map((r) => {
                  const count = members.filter(({ member: m }) => m.role === r.key).length;
                  const modified = isPreset(r.key) && ctx.roles.some((x) => x.key === r.key);
                  const own = r.key === ctx.member.role;
                  return (
                    <li key={r.key} className="flex flex-col gap-1.5 border-b border-ground py-3 last:border-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-bold">{r.name}</p>
                        <Status>{isPreset(r.key) ? (modified ? "Bawaan, diubah" : "Bawaan") : "Buatan sendiri"}</Status>
                        <span className="text-[12px] text-muted">{count ? `${count} anggota` : "Belum dipakai"}</span>
                        {manage && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <RoleEditor role={r} roles={roles} max={ctx.perms} locked={own ? "Minta pemilik untuk mengubah peranmu sendiri." : undefined} />
                            {!own && modified && (
                              <ActionButton
                                variant="ghost"
                                size="sm"
                                confirm={`Kembalikan izin ${r.name} ke bawaan? ${describePerms(PRESETS[r.key as keyof typeof PRESETS].perms)}`}
                                confirmLabel="Kembalikan"
                                action={deleteRole.bind(null, r.key)}
                              >
                                Kembalikan bawaan
                              </ActionButton>
                            )}
                            {!own && !isPreset(r.key) && (
                              <ActionButton variant="ghost" size="sm" confirm={`Hapus peran ${r.name}?`} action={deleteRole.bind(null, r.key)}>
                                Hapus
                              </ActionButton>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-[12px] leading-[1.5] text-muted">{describePerms(r.perms)}</p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {manage && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Undang anggota</SectionTitle>
              {seats > 0 ? (
                <ActionForm action={createInvite} submitLabel="Buat undangan" resetOnSuccess>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Peran" hint="Aksesnya bisa diatur lagi per orang setelah bergabung.">
                      <SelectField name="role" defaultValue={roles.find((r) => r.key === "keluarga") ? "keluarga" : roles[0]?.key} options={roleOptions} />
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
                          <strong>{roleName(inv.role, ctx.roles)}</strong>
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
          )}

          <Card className="flex flex-col gap-4">
            <SectionTitle>Akun kamu</SectionTitle>
            <ActionForm action={updateProfile} inlineSubmit submitVariant="ground">
              <Field label="Nama" className="min-w-[200px] flex-1">
                <Input name="name" required defaultValue={ctx.user.name} />
              </Field>
            </ActionForm>
            <p className="text-[13px] text-muted">Masuk dengan {ctx.user.email}.</p>
            <div className="flex flex-col gap-3 border-t border-ground pt-4">
              <h3 className="text-[14px] font-bold">Kata sandi</h3>
              <p className="text-[13px] text-muted">
                Buat atau ganti kata sandi untuk masuk dengan email dan kata sandi. Perangkat lain yang masih masuk akan dikeluarkan.
              </p>
              <ActionForm action={setPassword} submitLabel="Simpan kata sandi" submitVariant="ground" resetOnSuccess>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Kata sandi baru" hint="Minimal 8 karakter.">
                    <Input type="password" name="password" required minLength={8} maxLength={128} autoComplete="new-password" />
                  </Field>
                  <Field label="Ulangi kata sandi baru">
                    <Input type="password" name="confirm" required minLength={8} maxLength={128} autoComplete="new-password" />
                  </Field>
                </div>
              </ActionForm>
            </div>
            <WeddingSwitcher current={w.id} weddings={myWeddings.map((x) => ({ id: x.id, name: `${x.groom} & ${x.bride}` }))} />
            <LinkButton href="/onboarding?baru=1" variant="ground" className="self-start">
              Buat ruang pernikahan lain
            </LinkButton>
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>Pasang di HP</SectionTitle>
            <p className="text-[13px] text-muted">
              Pasang Rukun di layar utama supaya bisa dibuka seperti aplikasi, tanpa bar alamat browser.
            </p>
            <InstallApp variant="card" />
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>Data dan privasi</SectionTitle>
            <p className="text-[13px] text-muted">
              Ekspor daftar tamu kapan saja. Pemilik bisa menghapus seluruh ruang pernikahan, termasuk scan dokumen, secara permanen.
            </p>
            {can(ctx.perms, "tamu") && (
              <a href="/api/export/tamu" className="text-[13px] font-semibold underline">
                Unduh daftar tamu (CSV)
              </a>
            )}
            {ctx.member.role === "pemilik" && <DangerZone confirmText={`${w.groomName} & ${w.brideName}`} />}
          </Card>
        </div>
      </div>
    </>
  );
}
