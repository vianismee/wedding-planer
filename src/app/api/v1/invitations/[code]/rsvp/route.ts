import { db, schema } from "@/db";
import { ApiError, body, handler, notFound, preflight } from "@/lib/api";
import { byCode, publicGuest, rsvpInput } from "@/lib/api-guest";

export const OPTIONS = preflight;

/** Kirim atau ubah RSVP. Jumlah yang hadir tidak boleh melebihi jatah undangan tamu itu. */
export const POST = handler<{ code: string }>("any", async ({ weddingId, req }, { code }) => {
  const input = rsvpInput.parse(await body(req));
  const where = byCode(weddingId, code);
  const [guest] = await db.select().from(schema.guest).where(where);
  if (!guest) throw notFound("Undangan");
  const pax = input.attendance === "tidak_hadir" ? 0 : (input.pax ?? guest.pax);
  if (pax > guest.pax) throw new ApiError(422, "pax_exceeded", `Undangan ini untuk ${guest.pax} orang.`);
  if (input.attendance === "hadir" && pax < 1) throw new ApiError(422, "validation_error", "pax: minimal 1 bila hadir.");
  const now = new Date();
  const [row] = await db
    .update(schema.guest)
    .set({
      rsvp: input.attendance,
      rsvpPax: pax,
      rsvpMessage: input.message === undefined ? guest.rsvpMessage : input.message,
      rsvpAt: now,
      openedAt: guest.openedAt ?? now,
    })
    .where(where)
    .returning();
  return publicGuest(row);
});
