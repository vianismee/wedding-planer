import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { dateLong, time } from "@/lib/format";

export const metadata: Metadata = { title: "Rundown", robots: { index: false, follow: false } };

export default async function PublicRundown({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`rundown:${ip}`, 60, 60_000)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[640px] items-center p-4">
        <p className="rounded-[18px] bg-warn-bg p-5 text-[14px] font-semibold text-warn-fg">
          Terlalu banyak permintaan dari jaringan ini. Coba lagi dalam satu menit.
        </p>
      </main>
    );
  }
  if (!/^[a-f0-9]{20}$/.test(token)) notFound();

  const [row] = await db
    .select({ event: schema.event, wedding: schema.wedding })
    .from(schema.event)
    .innerJoin(schema.wedding, eq(schema.event.weddingId, schema.wedding.id))
    .where(eq(schema.event.shareToken, token));
  if (!row) notFound();
  const items = await db
    .select()
    .from(schema.rundownItem)
    .where(eq(schema.rundownItem.eventId, row.event.id))
    .orderBy(asc(schema.rundownItem.sortOrder));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-5 p-4 py-8">
      <header className="on-ink flex flex-col gap-1 rounded-[24px] bg-ink p-5 text-white">
        <p className="text-[12px] font-semibold text-[#c9c8d6]">
          Pernikahan {row.wedding.groomName} dan {row.wedding.brideName}
        </p>
        <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">Rundown {row.event.name.toLowerCase()}</h1>
        <p className="text-[14px] text-[#d9d8e4]">{dateLong(row.event.date)}</p>
        {row.event.location && <p className="text-[14px] text-[#d9d8e4]">{row.event.location}</p>}
      </header>
      <section className="rounded-[22px] bg-surface p-5">
        {items.length === 0 ? (
          <p className="text-[14px] text-muted">Rundown belum diisi. Hubungi keluarga pengantin untuk jadwal terbaru.</p>
        ) : (
          <ol className="flex flex-col">
            {items.map((r) => (
              <li key={r.id} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3 border-b border-ground py-3 last:border-0">
                <span className="text-[15px] font-extrabold tabular">{time(r.time)}</span>
                <span>
                  <span className="block text-[15px] font-semibold">{r.activity}</span>
                  {r.pic && <span className="block text-[13px] text-muted">PIC {r.pic}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="text-center text-[12px] text-muted">Halaman baca-saja. Jam dalam WIB kecuali disebut lain.</p>
    </main>
  );
}
