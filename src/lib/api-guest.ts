import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { invitationLink, normInstagram, normPhone } from "@/lib/contact";

type Guest = typeof schema.guest.$inferSelect;

export const byCode = (weddingId: string, code: string) =>
  and(eq(schema.guest.weddingId, weddingId), eq(schema.guest.code, code.trim().toLowerCase()));

export async function invitationPattern(weddingId: string) {
  const [w] = await db.select({ url: schema.wedding.invitationUrl }).from(schema.wedding).where(eq(schema.wedding.id, weddingId));
  return w?.url ?? null;
}

const rsvpOf = (g: Guest) => ({
  status: g.rsvp,
  pax: g.rsvpPax,
  message: g.rsvpMessage,
  at: g.rsvpAt?.toISOString() ?? null,
});

/** Data lengkap untuk kunci server. */
export function fullGuest(g: Guest, pattern: string | null) {
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    note: g.note,
    phone: g.phone,
    instagram: g.instagram,
    address: g.address,
    category: g.category,
    side: g.side,
    session: g.session,
    pax: g.pax,
    delivery: g.delivery,
    status: g.status,
    vip: g.vip,
    invitationUrl: invitationLink(pattern, g.code),
    openedAt: g.openedAt?.toISOString() ?? null,
    rsvp: rsvpOf(g),
    createdAt: g.createdAt.toISOString(),
  };
}

/** Data yang boleh dilihat tamu sendiri di halaman undangan: tanpa kontak, alamat, atau catatan internal. */
export function publicGuest(g: Guest) {
  return {
    code: g.code,
    name: g.name,
    side: g.side,
    session: g.session,
    pax: g.pax,
    vip: g.vip,
    rsvp: rsvpOf(g),
  };
}

const phone = z
  .string()
  .max(30)
  .nullable()
  .transform((v, c) => {
    if (!v) return null;
    const n = normPhone(v);
    if (!n) c.addIssue({ code: "custom", message: "nomor WhatsApp tidak valid" });
    return n;
  });
const instagram = z
  .string()
  .max(120)
  .nullable()
  .transform((v, c) => {
    if (!v) return null;
    const n = normInstagram(v);
    if (!n) c.addIssue({ code: "custom", message: "username Instagram tidak valid" });
    return n;
  });
const text = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((v) => v?.trim() || null);

const fields = {
  name: z.string().trim().min(1).max(120),
  note: text(160),
  phone,
  instagram,
  address: text(300),
  category: z.string().trim().min(1).max(40),
  side: z.enum(["pria", "wanita"]),
  session: z.string().trim().min(1).max(40),
  pax: z.number().int().min(1).max(500),
  delivery: z.enum(["diantar", "whatsapp", "instagram", "email", "pos"]),
  status: z.enum(["belum_kirim", "terkirim", "cek_jumlah"]),
  vip: z.boolean(),
};

export const createGuest = z.strictObject({
  ...fields,
  note: fields.note.default(null),
  phone: fields.phone.default(null),
  instagram: fields.instagram.default(null),
  address: fields.address.default(null),
  category: fields.category.default("Lainnya"),
  session: fields.session.default("Sesi 1"),
  pax: fields.pax.default(2),
  delivery: fields.delivery.default("diantar"),
  status: fields.status.default("belum_kirim"),
  vip: fields.vip.default(false),
});

export const updateGuest = z.strictObject(fields).partial();

export const rsvpInput = z.strictObject({
  attendance: z.enum(["hadir", "tidak_hadir", "ragu"]),
  pax: z.number().int().min(0).max(500).optional(),
  message: text(500).optional(),
});
