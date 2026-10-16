import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { dateShort, rupiah } from "@/lib/format";
import { addItem, renameCategory } from "@/actions/seserahan";
import { FormDialog } from "@/components/forms";
import { Card, Field, Input, PageHeader, Progress, SectionTitle, Status } from "@/components/kit";
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
  // Total gabungan seserahan dan mahar.
  const maharTotal = maharItems.reduce((s, m) => s + m.value, 0);
  const maharSpent = maharItems.filter((m) => m.status === "terbeli").reduce((s, m) => s + m.value, 0);
  const grand = planned + maharTotal;
  const grandSpent = spent + maharSpent;
  const allCount = items.length + maharItems.length;
  const allBought = bought.length + maharItems.filter((m) => m.status === "terbeli").length;

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
            const subtotal = list.reduce((s, i) => s + i.price, 0);
            return (
              <section key={cat} className="flex flex-col gap-1 rounded-[22px] bg-surface p-4" aria-label={cat}>
                <div className="flex items-start justify-between gap-2 pb-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-0.5">
                      <h2 className="truncate text-[16px] font-bold">{cat}</h2>
                      <FormDialog
                        variant="icon"
                        triggerLabel={`Ubah nama kategori ${cat}`}
                        triggerClassName="hit-44 size-9 shrink-0"
                        title="Ubah nama kategori"
                        description={`Nama baru berlaku untuk ${list.length} item di kategori ini.`}
                        action={renameCategory.bind(null, cat)}
                        trigger={<Pencil size={14} aria-hidden="true" />}
                      >
                        <Field label="Nama kategori" hint="Bila sama dengan kategori lain, kedua kategori akan digabung.">
                          <Input name="name" required defaultValue={cat} maxLength={60} />
                        </Field>
                      </FormDialog>
                    </div>
                    <p className="text-[12px] text-muted">{subtotal > 0 ? `Subtotal ${rupiah(subtotal)}` : "Harga belum diisi"}</p>
                  </div>
                  <Status tone={done === list.length ? "ok" : "neutral"} className="mt-1.5">
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
              <p className="text-[12px] font-semibold text-muted">Total seserahan dan mahar</p>
              <p className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] tabular">{rupiah(grand)}</p>
            </div>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Seserahan, {items.length} item</dt>
                <dd className="font-bold tabular">{rupiah(planned)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Mahar, {maharItems.length} item</dt>
                <dd className="font-bold tabular">{rupiah(maharTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-ground pt-2">
                <dt className="text-muted">Sudah dibeli</dt>
                <dd className="font-bold tabular">{rupiah(grandSpent)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Belum dibeli</dt>
                <dd className="font-bold tabular">{rupiah(Math.max(0, grand - grandSpent))}</dd>
              </div>
            </dl>
            <div>
              <p className="text-[13px] font-semibold">
                {allBought} dari {allCount} item terbeli
                {items.some((i) => i.status === "dipesan") ? `, ${items.filter((i) => i.status === "dipesan").length} masih dipesan` : ""}
              </p>
              <Progress value={allCount ? (allBought / allCount) * 100 : 0} label="Item terbeli" className="mt-2" />
            </div>
            {items.some((i) => !i.price) && (
              <p className="text-[12px] text-muted">{items.filter((i) => !i.price).length} item belum diisi harganya, jadi belum masuk total.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
