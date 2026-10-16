import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { dateShort, rupiahShort } from "@/lib/format";
import { addItem } from "@/actions/seserahan";
import { FormDialog } from "@/components/forms";
import { Card, PageHeader, Progress, SectionTitle, Status } from "@/components/kit";
import type { SeserahanItem } from "@/db/schema";
import { MaharCard } from "./mahar-card";
import { ItemStatus } from "./item-status";
import { ItemDetail, ItemFields } from "./item-detail";

export const metadata: Metadata = { title: "Seserahan dan mahar" };

export default async function SeserahanPage() {
  const ctx = await requirePage("seserahan");
  const wid = ctx.wedding.id;
  const [items, maharItems, akad] = await Promise.all([
    db.select().from(schema.seserahanItem).where(eq(schema.seserahanItem.weddingId, wid)).orderBy(asc(schema.seserahanItem.sortOrder), asc(schema.seserahanItem.name)),
    db.select().from(schema.maharItem).where(eq(schema.maharItem.weddingId, wid)).orderBy(asc(schema.maharItem.sortOrder), asc(schema.maharItem.createdAt)),
    db.select().from(schema.event).where(eq(schema.event.weddingId, wid)),
  ]);
  const akadEvent = akad.find((e) => e.kind === "akad");

  const groups = new Map<string, SeserahanItem[]>();
  for (const it of items) groups.set(it.category, [...(groups.get(it.category) ?? []), it]);
  const categories = [...groups.keys()];

  const bought = items.filter((i) => i.status === "terbeli");
  const spent = bought.reduce((s, i) => s + i.price, 0);
  const planned = items.reduce((s, i) => s + i.price, 0);

  return (
    <>
      <PageHeader
        title="Seserahan dan mahar"
        description={`Diserahkan saat akad, ${dateShort(akadEvent?.date ?? ctx.wedding.akadDate)}.`}
        actions={
          <FormDialog
            title="Tambah item seserahan"
            action={addItem}
            trigger={
              <>
                <Plus size={16} aria-hidden="true" />
                Tambah item
              </>
            }
          >
            <ItemFields categories={categories} />
          </FormDialog>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 items-start gap-4 min-[720px]:grid-cols-2">
          {items.length === 0 && (
            <div className="rounded-[22px] bg-surface p-5 min-[720px]:col-span-2">
              <p className="text-[14px] font-bold">Belum ada item seserahan.</p>
              <p className="text-[13px] text-muted">Tambahkan item pertama, misalnya seperangkat alat salat.</p>
            </div>
          )}
          {[...groups.entries()].map(([cat, list]) => {
            const done = list.filter((i) => i.status === "terbeli").length;
            return (
              <section key={cat} className="flex flex-col gap-1 rounded-[22px] bg-surface p-4" aria-label={cat}>
                <div className="flex items-center justify-between gap-2 pb-1">
                  <h2 className="text-[16px] font-bold">{cat}</h2>
                  <Status tone={done === list.length ? "ok" : "neutral"}>
                    {done} dari {list.length}
                  </Status>
                </div>
                {list.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 border-b border-ground py-1 last:border-0">
                    <ItemDetail it={it} categories={categories} />
                    <ItemStatus id={it.id} status={it.status} name={it.name} />
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col gap-5">
          <MaharCard items={maharItems} />

          <Card className="flex flex-col gap-3">
            <SectionTitle>Ringkasan</SectionTitle>
            <div>
              <p className="text-[24px] font-extrabold tracking-[-0.02em]">
                {bought.length} <span className="text-[14px] font-semibold text-muted">dari {items.length} item terbeli</span>
              </p>
              <Progress value={items.length ? (bought.length / items.length) * 100 : 0} label="Item terbeli" className="mt-2" />
            </div>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Sudah dibelanjakan</dt>
                <dd className="font-bold">{rupiahShort(spent)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Total perkiraan</dt>
                <dd className="font-bold">{rupiahShort(planned)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Masih dipesan</dt>
                <dd className="font-bold">{items.filter((i) => i.status === "dipesan").length} item</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
