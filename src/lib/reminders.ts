import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendMail } from "./mailer";
import { addDays, dateLong, rupiah, todayISO } from "./format";

/**
 * Mengirim pengingat email termin vendor H-7 dan H-1 ke anggota berperan Pemilik dan Pasangan.
 * Idempoten: setiap termin ditandai setelah pengingat terkirim.
 */
export async function runReminders(today = todayISO()) {
  const rows = await db
    .select({ term: schema.paymentTerm, vendor: schema.vendor, wedding: schema.wedding })
    .from(schema.paymentTerm)
    .innerJoin(schema.vendor, eq(schema.paymentTerm.vendorId, schema.vendor.id))
    .innerJoin(schema.wedding, eq(schema.paymentTerm.weddingId, schema.wedding.id))
    .where(and(isNull(schema.paymentTerm.paidAt), gte(schema.paymentTerm.dueDate, today), lte(schema.paymentTerm.dueDate, addDays(today, 7))));

  let sent = 0;
  for (const { term, vendor, wedding } of rows) {
    const h1 = term.dueDate <= addDays(today, 1);
    const kind = h1 ? (term.remindedH1 ? null : "H-1") : term.remindedH7 ? null : "H-7";
    if (!kind) continue;

    const recipients = await db
      .select({ email: schema.user.email })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(and(eq(schema.member.weddingId, wedding.id), inArray(schema.member.role, ["pemilik", "pasangan"])));
    if (recipients.length === 0) continue;

    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    await sendMail({
      to: recipients.map((r) => r.email),
      subject: `${kind === "H-1" ? "Besok" : "7 hari lagi"}: ${term.label} ${vendor.name} ${rupiah(term.amount)}`,
      text: [
        `Pengingat pembayaran vendor untuk pernikahan ${wedding.groomName} dan ${wedding.brideName}.`,
        "",
        `Vendor: ${vendor.name}`,
        `Termin: ${term.label}`,
        `Nominal: ${rupiah(term.amount)}`,
        `Jatuh tempo: ${dateLong(term.dueDate)}`,
        vendor.contact ? `Kontak vendor: ${vendor.contact}` : "",
        "",
        `Tandai lunas setelah membayar: ${base}/budget`,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });
    await db
      .update(schema.paymentTerm)
      .set(kind === "H-1" ? { remindedH1: true, remindedH7: true } : { remindedH7: true })
      .where(eq(schema.paymentTerm.id, term.id));
    sent++;
  }
  return { checked: rows.length, sent };
}
