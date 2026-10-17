"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getContext, getSession, isMember, requireAction, WEDDING_COOKIE } from "@/lib/session";
import { optStr, run, str, UserError, type ActionResult } from "@/lib/action";
import { ACCESS, can, MAX_MEMBERS, ROLE_LABEL, type Area, type Role } from "@/lib/roles";
import { sendMail } from "@/lib/mailer";
import { INVITE_COOKIE } from "@/lib/invites";
import { track } from "@/lib/analytics";
import { PASSWORD_MAX, PASSWORD_MIN, setUserPassword } from "@/lib/password";

const inviteRole = z.enum(["pasangan", "keluarga", "panitia"], { message: "Pilih peran." });

async function seatsLeft(weddingId: string) {
  const members = await db.select().from(schema.member).where(eq(schema.member.weddingId, weddingId));
  return MAX_MEMBERS - members.length;
}

export async function createInvite(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const role = inviteRole.parse(str(fd, "role"));
    const email = optStr(fd, "email");
    if (email) z.email("Format email tidak valid.").parse(email);
    if ((await seatsLeft(ctx.wedding.id)) <= 0) throw new UserError(`Maksimal ${MAX_MEMBERS} anggota per pernikahan.`);

    const token = crypto.randomUUID().replace(/-/g, "");
    await db.insert(schema.invite).values({
      weddingId: ctx.wedding.id,
      token,
      email,
      role,
      createdBy: ctx.user.id,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    });
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const link = `${base}/undangan/${token}`;
    if (email) {
      await sendMail({
        to: email,
        subject: `Undangan bergabung ke persiapan pernikahan ${ctx.wedding.groomName} dan ${ctx.wedding.brideName}`,
        text: `${ctx.user.name} mengundangmu bergabung sebagai ${ROLE_LABEL[role]} di Rukun.\n\nBuka link berikut untuk bergabung (berlaku 14 hari):\n${link}`,
      });
    }
    track("member_invited", { weddingId: ctx.wedding.id, role });
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

export async function changeRole(memberId: string, role: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const r = inviteRole.parse(role);
    const [m] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.id, memberId), eq(schema.member.weddingId, ctx.wedding.id)));
    if (!m) throw new UserError("Anggota tidak ditemukan.");
    if (m.role === "pemilik") throw new UserError("Peran pemilik tidak bisa diubah.");
    await db.update(schema.member).set({ role: r }).where(eq(schema.member.id, memberId));
    revalidatePath("/pengaturan");
  });
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAction("pengaturan");
    const [m] = await db
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.id, memberId), eq(schema.member.weddingId, ctx.wedding.id)));
    if (!m) throw new UserError("Anggota tidak ditemukan.");
    if (m.role === "pemilik") throw new UserError("Pemilik tidak bisa dikeluarkan.");
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
      await db.insert(schema.member).values({ weddingId: inv.weddingId, userId: session.user.id, role: inv.role as Role });
    }
    await db.update(schema.invite).set({ acceptedAt: new Date() }).where(eq(schema.invite.id, inv.id));
    const jar = await cookies();
    jar.set(WEDDING_COOKIE, inv.weddingId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    jar.delete(INVITE_COOKIE);
    track("member_joined", { weddingId: inv.weddingId, role: inv.role });
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
    // Hanya menu yang boleh dibuka peran ini.
    const allowed = list.filter((id, i) => list.indexOf(id) === i && id in ACCESS && can(ctx.member.role, id as Area));
    await db
      .update(schema.member)
      .set({ capsuleItems: allowed.length ? allowed : null })
      .where(eq(schema.member.id, ctx.member.id));
    revalidatePath("/", "layout");
    return allowed.length ? "Menu capsule tersimpan." : "Menu capsule kembali ke bawaan.";
  });
}
