import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { Check } from "lucide-react";
import { db, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { dateLong, dateShort, rupiah, time, todayISO } from "@/lib/format";
import { scheduleKind } from "@/lib/schedule-kinds";
import { addonsTotal } from "@/lib/offer";

export const metadata: Metadata = { title: "Ringkasan pesanan", robots: { index: false, follow: false } };

// Halaman baca-saja untuk vendor. Hanya memuat data pesanan vendor itu:
// tidak ada budget, tamu, dokumen, catatan internal, atau kontak pribadi pengantin.
export default async function VendorSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`vendor-share:${ip}`, 60, 60_000)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[720px] items-center p-4">
        <p className="rounded-[18px] bg-warn-bg p-5 text-[14px] font-semibold text-warn-fg">
          Terlalu banyak permintaan dari jaringan ini. Coba lagi dalam satu menit.
        </p>
      </main>
    );
  }
  if (!/^[a-f0-9]{24}$/.test(token)) notFound();

  const [row] = await db
    .select({ vendor: schema.vendor, wedding: schema.wedding, category: schema.budgetCategory.name })
    .from(schema.vendor)
    .innerJoin(schema.wedding, eq(schema.vendor.weddingId, schema.wedding.id))
    .leftJoin(schema.budgetCategory, eq(schema.vendor.categoryId, schema.budgetCategory.id))
    .where(eq(schema.vendor.shareToken, token));
  if (!row) notFound();
  const { vendor: v, wedding: w } = row;
  const today = todayISO();

  const [terms, events, schedules] = await Promise.all([
    db.select().from(schema.paymentTerm).where(eq(schema.paymentTerm.vendorId, v.id)).orderBy(asc(schema.paymentTerm.dueDate)),
    db
      .select()
      .from(schema.event)
      .where(eq(schema.event.weddingId, w.id))
      .orderBy(asc(schema.event.date), asc(schema.event.sortOrder)),
    db
      .select()
      .from(schema.schedule)
      .where(and(eq(schema.schedule.vendorId, v.id), gte(schema.schedule.date, today)))
      .orderBy(asc(schema.schedule.date), asc(schema.schedule.startTime)),
  ]);
  const paid = terms.filter((t) => t.paidAt).reduce((s, t) => s + t.amount, 0);
  const upcomingEvents = events.filter((e) => e.date && e.date >= today && e.status !== "selesai");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col gap-5 px-4 py-8">
      <header className="on-ink flex flex-col gap-1 rounded-[24px] bg-ink p-5 text-white sm:p-6">
        <p className="text-[12px] font-semibold text-[#c9c8d6]">Ringkasan pesanan{row.category ? `, ${row.category}` : ""}</p>
        <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">{v.name}</h1>
        <p className="text-[14px] text-[#d9d8e4]">
          Pernikahan {w.groomName} dan {w.brideName}. Akad {dateLong(w.akadDate)}, {w.city}.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-[22px] bg-surface p-5" aria-labelledby="paket">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="paket" className="text-[18px] font-bold">
            {v.packageName || "Paket"}
          </h2>
          <span className="text-[22px] font-extrabold tracking-[-0.02em] tabular">{rupiah(v.totalPrice)}</span>
        </div>
        {v.includeItems.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[14px]">
            {v.includeItems.map((it, i) => (
              <li key={i} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden="true" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="flex flex-col gap-1.5 rounded-[14px] bg-sunken p-4 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Harga paket</dt>
            <dd className="font-semibold tabular">{rupiah(v.packagePrice)}</dd>
          </div>
          {v.addons.map((a, i) => (
            <div key={i} className="flex justify-between gap-3">
              <dt className="min-w-0 text-muted">
                Add-on: {a.label}
                {a.qty > 1 ? ` x${a.qty}` : ""}
              </dt>
              <dd className="shrink-0 font-semibold tabular">{rupiah(a.qty * a.price)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2">
            <dt className="min-w-0 font-bold">
              Total
              {v.addons.length > 0 && <span className="block text-[12px] font-semibold text-muted">termasuk add-on {rupiah(addonsTotal(v.addons))}</span>}
            </dt>
            <dd className="shrink-0 whitespace-nowrap font-extrabold tabular">{rupiah(v.totalPrice)}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-[22px] bg-surface p-5" aria-labelledby="bayar">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bayar" className="text-[18px] font-bold">
            Jadwal pembayaran
          </h2>
          <span className="text-[13px] text-muted">
            Terbayar <strong className="text-ink">{rupiah(paid)}</strong>, sisa <strong className="text-ink">{rupiah(Math.max(0, v.totalPrice - paid))}</strong>
          </span>
        </div>
        {terms.length === 0 ? (
          <p className="text-[14px] text-muted">Jadwal pembayaran belum dibuat.</p>
        ) : (
          <ul className="flex flex-col">
            {terms.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b border-ground py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">{t.label}</div>
                  <div className="text-[12px] text-muted">{t.paidAt ? `Dibayar ${dateShort(t.paidAt)}` : `Jatuh tempo ${dateShort(t.dueDate)}`}</div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold tabular">{rupiah(t.amount)}</span>
                <span
                  className={
                    t.paidAt
                      ? "rounded-md bg-ok-bg px-2 py-[3px] text-[11px] font-bold text-ok-fg"
                      : "rounded-md bg-ground px-2 py-[3px] text-[11px] font-bold text-ink"
                  }
                >
                  {t.paidAt ? "Lunas" : "Belum dibayar"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {upcomingEvents.length > 0 && (
        <section className="flex flex-col gap-3 rounded-[22px] bg-surface p-5" aria-labelledby="acara">
          <h2 id="acara" className="text-[18px] font-bold">
            Rangkaian acara
          </h2>
          <ul className="flex flex-col">
            {upcomingEvents.map((e) => (
              <li key={e.id} className="grid grid-cols-1 gap-0.5 border-b border-ground py-2.5 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3">
                <span className="text-[13px] font-bold">
                  {dateShort(e.date)}
                  {e.startTime ? `, ${time(e.startTime)} WIB` : ""}
                </span>
                <span className="text-[14px]">
                  <span className="font-semibold">{e.name}</span>
                  {e.location ? <span className="text-muted">, {e.location}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {schedules.length > 0 && (
        <section className="flex flex-col gap-3 rounded-[22px] bg-surface p-5" aria-labelledby="janji">
          <h2 id="janji" className="text-[18px] font-bold">
            Janji temu dengan {v.name}
          </h2>
          <ul className="flex flex-col">
            {schedules.map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-0.5 border-b border-ground py-2.5 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3">
                <span className="text-[13px] font-bold">
                  {dateShort(s.date)}
                  {s.startTime ? `, ${time(s.startTime)} WIB` : ""}
                </span>
                <span className="text-[14px]">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-muted">
                    , {scheduleKind(s.kind).name.toLowerCase()}
                    {s.location ? `, ${s.location}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[12px] text-muted">
        Halaman baca-saja dari Rukun. Hubungi pengantin bila ada data yang perlu diperbaiki.
      </p>
    </main>
  );
}
