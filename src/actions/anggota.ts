"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getContext, getSession, isMember, requireAction, WEDDING_COOKIE } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import {
  AREA_IDS,
  AREAS,
  can,
  isPreset,
  MAX_MEMBERS,
  MAX_ROLES,
  normalize,
  PRESETS,
  resolvePerms,
  roleList,
  roleName,
  within,
  type Area,
  type Perms,
} from "@/lib/roles";
import type { Ctx } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { INVITE_COOKIE } from "@/lib/invites";
import { track } from "@/lib/analytics";
import { PASSWORD_MAX, PASSWORD_MIN, setUserPassword } from "@/lib/password";

/* ---------- Penjaga izin ---------- */

/** Peran yang boleh dipilih: semua peran pernikahan ini kecuali Pemilik. */
function assignableRole(ctx: Ctx, key: string) {
  const role = roleList(ctx.roles).find((r) => r.key === key);
  if (!role) throw new UserError("Pilih peran.");
  return role;
}

/** Pengelola tidak bisa memberi izin lebih tinggi dari yang ia punya sendiri. Pemilik punya semuanya. */
function assertWithin(ctx: Ctx, perms: Perms) {
  if (!within(perms, ctx.perms)) throw new UserError("Kamu tidak bisa memberi akses yang lebih tinggi dari aksesmu sendiri.");
}

/** Anggota yang boleh diatur: bukan Pemilik, bukan diri sendiri, dan aksesnya tidak lebih tinggi dari pengelola. */
async function managedMember(ctx: Ctx, memberId: string) {
  const [m] = await db
    .select()
    .from(schema.member)
    .where(and(eq(schema.member.id, memberId), eq(schema.member.weddingId, ctx.wedding.id)));
  if (!m) throw new UserError("Anggota tidak ditemukan.");
  if (m.role === "pemilik") throw new UserError("Akses pemilik tidak bisa diubah.");
  if (m.userId === ctx.user.id) throw new UserError("Kamu tidak bisa mengubah aksesmu sendiri. Minta pemilik untuk mengubahnya.");
  if (!within(resolvePerms(m.role, m.perms, ctx.roles), ctx.perms)) throw new UserError("Anggota ini punya akses lebih tinggi darimu.");
  return m;
}

const permsInput = z.record(z.enum(AREA_IDS as [Area, ...Area[]]), z.enum(["none", "own", "view", "edit"]));

/** Izin dari formulir: setiap halaman wajib punya tingkat yang memang tersedia untuk halaman itu. */
function parsePerms(input: unknown): Perms {
  const raw = permsInput.parse(input);
  const out = normalize(raw);
  if (AREAS.some((a) => raw[a.id] && raw[a.id] !== out[a.id])) throw new UserError("Ada izin yang tidak valid. Muat ulang halaman lalu coba lagi.");
  return out;
}

async function seatsLeft(weddingId: string) {
  const members = await db.select().from(schema.member).where(eq(schema.member.weddingId, weddingId));
  return MAX_MEMBERS - members.length;
}

export async function createInvite(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const role = assignableRole(ctx, str(fd, "role"));
    assertWithin(ctx, role.perms);
    const email = optStr(fd, "email");
    if (email) z.email("Format email tidak valid.").parse(email);
    if ((await seatsLeft(ctx.wedding.id)) <= 0) throw new UserError(`Maksimal ${MAX_MEMBERS} anggota per pernikahan.`);

    const token = crypto.randomUUID().replace(/-/g, "");
    await db.insert(schema.invite).values({
      weddingId: ctx.wedding.id,
      token,
      email,
      role: role.key,
      createdBy: ctx.user.id,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    });
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const link = `${base}/undangan/${token}`;
    if (email) {
      await sendMail({
        to: email,
        subject: `Undangan bergabung ke persiapan pernikahan ${ctx.wedding.groomName} dan ${ctx.wedding.brideName}`,
        text: `${ctx.user.name} mengundangmu bergabung sebagai ${role.name} di Rukun.\n\nBuka link berikut untuk bergabung (berlaku 14 hari):\n${link}`,
      });
    }
    track("member_invited", { weddingId: ctx.wedding.id, role: isPreset(role.key) ? role.key : "kustom" });
    revalidatePath("/pengaturan");
    return email ? `Undangan dikirim ke ${email}.` : "Link undangan dibuat. Salin dan bagikan lewat WhatsApp.";
  });
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    await db.delete(schema.invite).where(and(eq(schema.invite.id, id), eq(schema.invite.weddingId, ctx.wedding.id)));
    revalidatePath("/pengaturan");
  });
}

/** Ganti peran anggota. Pengecualian pribadinya tetap berlaku di atas peran baru. */
export async function changeRole(memberId: string, role: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const m = await managedMember(ctx, memberId);
    const r = assignableRole(ctx, role);
    assertWithin(ctx, resolvePerms(r.key, m.perms, ctx.roles));
    await db.update(schema.member).set({ role: r.key }).where(eq(schema.member.id, memberId));
    revalidatePath("/", "layout");
    return `Peran diganti jadi ${r.name}.`;
  });
}

/**
 * Atur izin khusus satu anggota. Yang disimpan hanya halaman yang berbeda dari perannya, supaya
 * perubahan peran tetap berlaku untuk halaman lain. Null = kembali ikut peran.
 */
export async function setMemberPerms(memberId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const m = await managedMember(ctx, memberId);
    const role = assignableRole(ctx, m.role);
    let override: Partial<Perms> | null = null;
    if (input !== null) {
      const perms = parsePerms(input);
      assertWithin(ctx, perms);
      const diff = Object.fromEntries(AREA_IDS.filter((a) => perms[a] !== role.perms[a]).map((a) => [a, perms[a]])) as Partial<Perms>;
      override = Object.keys(diff).length ? diff : null;
    }
    await db.update(schema.member).set({ perms: override }).where(eq(schema.member.id, memberId));
    revalidatePath("/", "layout");
    return override ? "Akses khusus anggota ini tersimpan." : `Akses kembali mengikuti peran ${role.name}.`;
  });
}

/* ---------- Peran ---------- */

/**
 * Simpan peran: ubah izin peran bawaan (Pasangan, Keluarga, Panitia) atau peran buatan sendiri,
 * atau buat peran baru bila `key` kosong. Berlaku untuk semua anggota dengan peran itu.
 */
export async function saveRole(key: string | null, name: string, input: unknown): Promise<ActionResult & { key?: string }> {
  let saved: string | undefined;
  const r = await run(async () => {
    const ctx = await requireAction("pengaturan");
    const title = z.string().trim().min(1, "Beri nama peran.").max(40, "Nama peran maksimal 40 huruf.").parse(name);
    const perms = parsePerms(input);
    assertWithin(ctx, perms);
    if (key && key === ctx.member.role) throw new UserError("Kamu tidak bisa mengubah peranmu sendiri. Minta pemilik untuk mengubahnya.");
    if (key && !roleList(ctx.roles).some((x) => x.key === key)) throw new UserError("Peran tidak ditemukan.");
    if (roleList(ctx.roles).some((x) => x.key !== key && x.name.toLowerCase() === title.toLowerCase())) throw new UserError(`Sudah ada peran bernama ${title}.`);
    if (!key && ctx.roles.filter((x) => !isPreset(x.key)).length >= MAX_ROLES) throw new UserError(`Maksimal ${MAX_ROLES} peran buatan sendiri.`);
    saved = key ?? `r_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await db
      .insert(schema.weddingRole)
      .values({ weddingId: ctx.wedding.id, key: saved, name: title, perms })
      .onConflictDoUpdate({ target: [schema.weddingRole.weddingId, schema.weddingRole.key], set: { name: title, perms } });
    revalidatePath("/", "layout");
    return key ? `Peran ${title} tersimpan.` : `Peran ${title} dibuat.`;
  });
  return { ...r, key: saved };
}

/** Peran bawaan kembali ke izin aslinya; peran buatan sendiri dihapus bila tidak ada yang memakainya. */
export async function deleteRole(key: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    if (key === ctx.member.role) throw new UserError("Kamu tidak bisa mengubah peranmu sendiri. Minta pemilik untuk mengubahnya.");
    if (isPreset(key)) assertWithin(ctx, PRESETS[key].perms);
    else {
      const users = await db
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(and(eq(schema.member.weddingId, ctx.wedding.id), eq(schema.member.role, key)));
      if (users.length) throw new UserError(`Masih ada ${users.length} anggota dengan peran ini. Ganti perannya dulu.`);
      const pending = await db
        .select({ id: schema.invite.id })
        .from(schema.invite)
        .where(
          and(eq(schema.invite.weddingId, ctx.wedding.id), eq(schema.invite.role, key), isNull(schema.invite.acceptedAt), gt(schema.invite.expiresAt, new Date())),
        );
      if (pending.length) throw new UserError("Masih ada undangan dengan peran ini. Batalkan undangannya dulu.");
    }
    await db.delete(schema.weddingRole).where(and(eq(schema.weddingRole.weddingId, ctx.wedding.id), eq(schema.weddingRole.key, key)));
    revalidatePath("/", "layout");
    return isPreset(key) ? `Peran ${PRESETS[key].name} kembali ke izin bawaan.` : `Peran ${roleName(key, ctx.roles)} dihapus.`;
  });
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    await managedMember(ctx, memberId);
    await db.delete(schema.member).where(eq(schema.member.id, memberId));
    revalidatePath("/pengaturan");
  });
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  return run(async () => {
    const session = await getSession();
    if (!session) throw new UserError("Masuk dulu untuk menerima undangan.");
    const [inv] = await db
      .select()
      .from(schema.invite)
      .where(and(eq(schema.invite.token, token), isNull(schema.invite.acceptedAt), gt(schema.invite.expiresAt, new Date())));
    if (!inv) throw new UserError("Undangan tidak berlaku atau sudah dipakai.");
    if (inv.email && inv.email.toLowerCase() !== session.user.email.toLowerCase())
      throw new UserError(`Undangan ini untuk ${inv.email}. Masuk dengan email tersebut.`);

    if (!(await isMember(inv.weddingId, session.user.id))) {
      if ((await seatsLeft(inv.weddingId)) <= 0) throw new UserError(`Pernikahan ini sudah punya ${MAX_MEMBERS} anggota.`);
      await db.insert(schema.member).values({ weddingId: inv.weddingId, userId: session.user.id, role: inv.role });
    }
    await db.update(schema.invite).set({ acceptedAt: new Date() }).where(eq(schema.invite.id, inv.id));
    const jar = await cookies();
    jar.set(WEDDING_COOKIE, inv.weddingId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    jar.delete(INVITE_COOKIE);
    track("member_joined", { weddingId: inv.weddingId, role: isPreset(inv.role) ? inv.role : "kustom" });
    revalidatePath("/", "layout");
  });
}

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const session = await getSession();
    if (!session) throw new UserError("Sesi berakhir.");
    const name = z.string().min(1, "Isi nama kamu.").max(80).parse(str(fd, "name"));
    await db.update(schema.user).set({ name }).where(eq(schema.user.id, session.user.id));
    revalidatePath("/", "layout");
    return "Nama tersimpan.";
  });
}

/**
 * Mengganti kata sandi langsung dari Pengaturan, tanpa kode email dan tanpa kata sandi lama
 * (aplikasi tidak mengirim email). Perangkat lain yang masih masuk dikeluarkan.
 */
export async function setPassword(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const session = await getSession();
    if (!session) throw new UserError("Sesi berakhir. Silakan masuk lagi.");
    const password = z
      .string()
      .min(PASSWORD_MIN, `Kata sandi minimal ${PASSWORD_MIN} karakter.`)
      .max(PASSWORD_MAX, `Kata sandi maksimal ${PASSWORD_MAX} karakter.`)
      .parse(String(fd.get("password") ?? ""));
    if (password !== String(fd.get("confirm") ?? "")) throw new UserError("Ulangi kata sandi yang sama di kolom kedua.");
    await setUserPassword(session.user.id, password);
    await db
      .delete(schema.session)
      .where(and(eq(schema.session.userId, session.user.id), ne(schema.session.id, session.session.id)));
    return "Kata sandi baru tersimpan. Perangkat lain yang masih masuk sudah dikeluarkan.";
  });
}

const CAPSULE_MAX = 4;

/** Menyimpan pilihan menu capsule nav (HP) untuk anggota yang sedang masuk. Kosong = kembali ke bawaan. */
export async function setCapsuleItems(items: string[]): Promise<ActionResult> {
  return run(async () => {
    const ctx = await getContext();
    if (!ctx) throw new UserError("Sesi berakhir. Silakan masuk lagi.");
    const list = z.array(z.string().max(20)).max(CAPSULE_MAX, `Maksimal ${CAPSULE_MAX} menu di capsule.`).parse(items);
    // Hanya menu yang boleh dibuka anggota ini. Pengaturan selalu boleh (akun pribadi).
    const allowed = list.filter((id, i) => list.indexOf(id) === i && (AREA_IDS as string[]).includes(id) && (id === "pengaturan" || can(ctx.perms, id as Area)));
    await db
      .update(schema.member)
      .set({ capsuleItems: allowed.length ? allowed : null })
      .where(eq(schema.member.id, ctx.member.id));
    revalidatePath("/", "layout");
    return allowed.length ? "Menu capsule tersimpan." : "Menu capsule kembali ke bawaan.";
  });
}
