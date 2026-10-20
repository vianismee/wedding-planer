import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { can } from "@/lib/roles";
import { computeCatering } from "@/lib/catering";
import { number, rupiah, rupiahShort } from "@/lib/format";
import { applyPlanToBudget, deletePlan } from "@/actions/catering";
import { ActionButton } from "@/components/forms";
import { Card, Empty, PageHeader, Status, ViewOnly, cx } from "@/components/kit";
import { PlanDialog } from "./plan-dialog";

export const metadata: Metadata = { title: "Catering" };

export default async function CateringPage() {
  const ctx = await requirePage("catering");
  const edit = can(ctx.perms, "catering", "edit");
  // Alokasi di Budget hanya tampil untuk yang boleh melihat Budget, dan hanya bisa diubah dari sini bila boleh mengubahnya.
  const seeBudget = can(ctx.perms, "budget");
  const setBudget = edit && can(ctx.perms, "budget", "edit");
  const wid = ctx.wedding.id;
  const [plans, guests, cats] = await Promise.all([
    db.select().from(schema.cateringPlan).where(eq(schema.cateringPlan.weddingId, wid)).orderBy(asc(schema.cateringPlan.createdAt)),
    db.select({ pax: schema.guest.pax, side: schema.guest.side }).from(schema.guest).where(eq(schema.guest.weddingId, wid)),
    db.select().from(schema.budgetCategory).where(eq(schema.budgetCategory.weddingId, wid)),
  ]);
  const guestPax = guests.reduce((s, g) => s + g.pax, 0);
  const allocation = seeBudget ? (cats.find((c) => c.name.toLowerCase().startsWith("catering"))?.allocation ?? 0) : 0;
  const results = plans.map((p) => ({ p, r: computeCatering(p, guestPax) }));
  const min = results.length > 1 ? Math.min(...results.map((x) => x.r.total)) : null;

  return (
    <>
      <PageHeader
        title="Catering"
        description="Hitung kebutuhan konsumsi dari jumlah tamu, lalu bandingkan vendor per pax dengan masak sendiri."
        actions={
          edit && (
            <PlanDialog
              guestPax={guestPax}
              trigger={
                <>
                  <Plus size={16} aria-hidden="true" />
                  Tambah skenario
                </>
              }
            />
          )
        }
      />
      {!edit && <ViewOnly what="perhitungan catering" />}

      <div className={cx("grid grid-cols-1 gap-3.5", seeBudget ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Card tone="ink" className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[#c9c8d6]">Jumlah orang dari daftar tamu</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{number(guestPax)}</span>
          <span className="text-[12px] text-[#c9c8d6]">dari {number(guests.length)} undangan</span>
        </Card>
        {seeBudget && (
          <Card className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">Alokasi Catering di Budget</span>
            <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{rupiahShort(allocation)}</span>
            <span className="text-[12px] text-muted">{guestPax ? `${rupiah(Math.round(allocation / guestPax))} per orang` : "Belum ada tamu"}</span>
          </Card>
        )}
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Skenario</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{plans.length}</span>
          <span className="text-[12px] text-muted">{min !== null ? `Termurah ${rupiahShort(min)}` : "Tambahkan dua skenario untuk membandingkan"}</span>
        </Card>
      </div>

      {plans.length === 0 ? (
        <Empty title="Belum ada perhitungan catering.">
          {edit
            ? "Tambahkan skenario pertama, misalnya catering per pax dari vendor, lalu bandingkan dengan masak sendiri dan menyewa juru masak."
            : "Skenario catering akan muncul di sini setelah ditambahkan."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-2 min-[1300px]:grid-cols-3">
          {results.map(({ p, r }) => {
            const d = allocation ? r.total - allocation : 0;
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-bold">{p.name}</h2>
                    <p className="text-[12px] text-muted">{p.mode === "per_pax" ? "Vendor catering per pax" : "Masak sendiri, sewa juru masak"}</p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {min !== null && r.total === min && <Status tone="ok">Termurah</Status>}
                    {edit && (
                      <>
                        <PlanDialog plan={p} guestPax={guestPax} variant="icon" triggerLabel={`Ubah ${p.name}`} trigger={<Pencil size={15} aria-hidden="true" />} />
                        <ActionButton variant="icon" label={`Hapus ${p.name}`} confirm={`Hapus skenario ${p.name}?`} action={deletePlan.bind(null, p.id)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </ActionButton>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{rupiahShort(r.total)}</div>
                  <div className="text-[12px] text-muted">
                    {number(r.portions)} porsi ({number(r.basePax)} orang
                    {p.bufferPercent ? ` + cadangan ${p.bufferPercent}%` : ""}), {rupiah(r.perPortion)} per porsi
                  </div>
                  {allocation > 0 && (
                    <div className={cx("mt-1 text-[12px] font-bold", d < 0 ? "text-ok-fg" : d > 0 ? "text-warn-fg" : "text-muted")}>
                      {d < 0 ? `${rupiahShort(-d)} di bawah alokasi` : d > 0 ? `${rupiahShort(d)} di atas alokasi` : "Pas dengan alokasi"}
                    </div>
                  )}
                </div>
                <ul className="flex flex-col gap-2 border-t border-ground pt-3 text-[13px]">
                  {r.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold">{l.label}</span>
                        {l.detail && <span className="block text-[12px] text-muted">{l.detail}</span>}
                      </span>
                      <span className="shrink-0 font-bold">{rupiahShort(l.amount)}</span>
                    </li>
                  ))}
                </ul>
                {p.notes && <p className="rounded-xl bg-sunken px-3 py-2 text-[12px]">{p.notes}</p>}
                {setBudget && (
                  <ActionButton
                    variant="ground"
                    className="mt-1"
                    confirm={`Jadikan ${rupiah(r.total)} sebagai alokasi Catering di Budget?`}
                    confirmLabel="Jadikan anggaran"
                    action={applyPlanToBudget.bind(null, p.id)}
                  >
                    Jadikan anggaran Catering
                  </ActionButton>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
