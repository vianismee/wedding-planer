import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  // Cegah formula injection saat dibuka di Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET() {
  const ctx = await getContext();
  if (!ctx || !can(ctx.member.role, "tamu")) return new Response("Tidak diizinkan", { status: 403 });
  const rows = await db
    .select()
    .from(schema.guest)
    .where(eq(schema.guest.weddingId, ctx.wedding.id))
    .orderBy(asc(schema.guest.name));
  const head = ["Nama", "Keterangan", "Kategori", "Pihak", "Sesi", "Jumlah", "Kirim via", "Status", "VIP"];
  const lines = [
    head.join(","),
    ...rows.map((g) =>
      [g.name, g.note, g.category, g.side, g.session, g.pax, g.delivery, g.status, g.vip ? "ya" : ""].map(esc).join(","),
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
