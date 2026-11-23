import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";
import { invitationLink } from "@/lib/contact";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  // Cegah formula injection saat dibuka di Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET() {
  const ctx = await getContext();
  if (!ctx || !can(ctx.perms, "tamu")) return new Response("Tidak diizinkan", { status: 403 });
  const rows = await db
    .select()
    .from(schema.guest)
    .where(eq(schema.guest.weddingId, ctx.wedding.id))
    .orderBy(asc(schema.guest.name));
  const head = ["Nama", "Keterangan", "WhatsApp", "Instagram", "Alamat", "Kategori", "Pihak", "Sesi", "Jumlah", "Kirim via", "Status", "VIP", "Kode", "Link undangan", "RSVP", "Jumlah hadir", "Ucapan"];
  const lines = [
    head.join(","),
    ...rows.map((g) =>
      [g.name, g.note, g.phone ? `+${g.phone}` : "", g.instagram ? `@${g.instagram}` : "", g.address, g.category, g.side, g.session, g.pax, g.delivery, g.status, g.vip ? "ya" : "", g.code, invitationLink(ctx.wedding.invitationUrl, g.code), g.rsvp, g.rsvpPax, g.rsvpMessage].map(esc).join(","),
    ),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daftar-tamu.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
