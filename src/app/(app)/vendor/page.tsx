import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { addDays, dateShort, relativeDays, rupiahShort, todayISO, diffDays } from "@/lib/format";
import { addVendor } from "@/actions/vendor";
import { FormDialog } from "@/components/forms";
import { Card, Empty, PageHeader, SectionTitle, Status } from "@/components/kit";
import { OfferCompare } from "./offer-compare";
import { VendorFields } from "./offer-fields";
import { VendorDetail } from "./vendor-detail";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const ctx = await requirePage("vendor");
  const wid = ctx.wedding.id;
  const today = todayISO();
  const { k } = await searchParams;

  const [cats, offers, vendors, terms, files] = await Promise.all([
    db.select().from(schema.budgetCategory).where(eq(schema.budgetCategory.weddingId, wid)).orderBy(asc(schema.budgetCategory.sortOrder)),
    db.select().from(schema.offer).where(eq(schema.offer.weddingId, wid)).orderBy(asc(schema.offer.createdAt)),
    db.select().from(schema.vendor).where(eq(schema.vendor.weddingId, wid)),
    db.select().from(schema.paymentTerm).where(eq(schema.paymentTerm.weddingId, wid)).orderBy(asc(schema.paymentTerm.dueDate)),
    db.select({ id: schema.file.id, name: schema.file.name }).from(schema.file).where(eq(schema.file.weddingId, wid)),
  ]);

  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const fileName = Object.fromEntries(files.map((f) => [f.id, f.name]));

  // Vendor terpesan diurutkan dari pembayaran terdekat; yang lunas di akhir.
  const booked = vendors
    .map((v) => {
      const vt = terms.filter((t) => t.vendorId === v.id);
      const paid = vt.filter((t) => t.paidAt).reduce((s, t) => s + t.amount, 0);
      const next = vt.find((t) => !t.paidAt) ?? null;
      const scheduled = vt.reduce((s, t) => s + t.amount, 0);
      return { v, terms: vt, paid, next, rest: Math.max(0, v.totalPrice - paid), unscheduled: Math.max(0, v.totalPrice - scheduled) };
    })
    .sort((a, b) => (a.next?.dueDate ?? "9999").localeCompare(b.next?.dueDate ?? "9999"));
  const totalRest = booked.reduce((s, b) => s + b.rest, 0);
  const catOpts = cats.map((c) => ({ id: c.id, name: c.name }));
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  return (
    <>
      <PageHeader
        title="Vendor"
        description="Bandingkan penawaran untuk kategori yang belum punya vendor, lalu pantau pembayaran vendor yang sudah dipesan."
      />

      <OfferCompare
        cats={cats.map((c) => ({ id: c.id, name: c.name, allocation: c.allocation, need: c.need }))}
        offers={offers}
        bookedCats={vendors.map((v) => v.categoryId).filter((x): x is string => Boolean(x))}
        initialCat={k}
        fileNames={fileName}
        defaults={{ dpDue: addDays(today, 7), settleDue: addDays(ctx.wedding.akadDate, -14) }}
      />

      <Card className="flex flex-col gap-3" aria-labelledby="booked-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle id="booked-title">Sudah dipesan</SectionTitle>
            <p className="text-[13px] text-muted">Urut dari pembayaran terdekat. Klik nama vendor untuk detail paket, termin, dan link untuk vendor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[13px] text-muted">
              Sisa yang harus dibayar <strong className="text-[16px] text-ink">{rupiahShort(totalRest)}</strong>
            </p>
            <FormDialog
              variant="ground"
              wide
              title="Tambah vendor yang sudah dipesan"
              description="Untuk vendor yang dipesan tanpa perbandingan penawaran."
              action={addVendor}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Vendor
                </>
              }
            >
              <VendorFields cats={catOpts} />
            </FormDialog>
          </div>
        </div>

        {booked.length === 0 ? (
          <Empty title="Belum ada vendor yang dipesan.">
            Pilih penawaran di atas untuk memesan vendor. Termin DP otomatis dijadwalkan di Budget.
          </Empty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th scope="col" className="w-[24%] border-b border-line py-2.5 pr-3 font-semibold">Pembayaran berikutnya</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">Vendor</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Total</th>
                  <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-semibold">Terbayar</th>
                  <th scope="col" className="border-b border-line py-2.5 pl-3 text-right font-semibold">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {booked.map(({ v, terms: vt, paid, next, rest, unscheduled }) => {
                  const d = next ? diffDays(today, next.dueDate) : null;
                  return (
                    <tr key={v.id} className="border-b border-ground align-middle last:border-0">
                      <td className="py-3 pr-3">
                        {next ? (
                          <>
                            <div className="font-bold">
                              {next.label} {rupiahShort(next.amount)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-[12px] text-muted">{dateShort(next.dueDate)}</span>
                              <Status tone={d! <= 7 ? "warn" : "neutral"}>{relativeDays(next.dueDate, today)}</Status>
                            </div>
                          </>
                        ) : rest === 0 && v.totalPrice > 0 ? (
                          <Status tone="ok">Lunas</Status>
                        ) : (
                          <span className="text-[12px] text-muted">Belum ada termin</span>
                        )}
                        {unscheduled > 0 && <div className="mt-1 text-[11px] font-semibold text-warn-fg">{rupiahShort(unscheduled)} belum dijadwalkan</div>}
                      </td>
                      <td className="max-w-[320px] px-3 py-2">
                        <VendorDetail
                          v={v}
                          terms={vt}
                          cats={catOpts}
                          categoryName={v.categoryId ? catName.get(v.categoryId) ?? "Tanpa kategori" : "Tanpa kategori"}
                          paid={paid}
                          rest={rest}
                          unscheduled={unscheduled}
                          baseUrl={baseUrl}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular">{rupiahShort(v.totalPrice)}</td>
                      <td className="px-3 py-3 text-right tabular">{rupiahShort(paid)}</td>
                      <td className="py-3 pl-3 text-right font-bold tabular">{rupiahShort(rest)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
