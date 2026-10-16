import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/session";
import { number } from "@/lib/format";
import { Card, Note, PageHeader, Progress, cx } from "@/components/kit";
import { GuestManager } from "./guest-manager";

export const metadata: Metadata = { title: "Daftar tamu" };

export default async function TamuPage() {
  const ctx = await requirePage("tamu");
  const w = ctx.wedding;
  const guests = await db
    .select({
      id: schema.guest.id,
      name: schema.guest.name,
      note: schema.guest.note,
      category: schema.guest.category,
      side: schema.guest.side,
      session: schema.guest.session,
      pax: schema.guest.pax,
      delivery: schema.guest.delivery,
      status: schema.guest.status,
      vip: schema.guest.vip,
    })
    .from(schema.guest)
    .where(eq(schema.guest.weddingId, w.id))
    .orderBy(asc(schema.guest.name));

  const paxBy = (side: string) => guests.filter((g) => g.side === side).reduce((s, g) => s + g.pax, 0);
  const pria = paxBy("pria");
  const wanita = paxBy("wanita");
  const total = pria + wanita;
  const sent = guests.filter((g) => g.status === "terkirim").length;
  const overPria = pria - w.quotaGroom;
  const overWanita = wanita - w.quotaBride;

  return (
    <>
      <PageHeader
        title="Daftar tamu"
        description="Kuota dan porsi catering dihitung dari jumlah orang, bukan jumlah undangan."
        actions={
          <a
            href="/api/export/tamu"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface px-4 text-[13px] font-bold text-ink no-underline hover:bg-sunken"
          >
            <Download size={16} aria-hidden="true" />
            Ekspor CSV
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 min-[1100px]:grid-cols-4">
        <Card tone="ink" className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[#c9c8d6]">Porsi catering</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{number(total)}</span>
          <span className="text-[12px] text-[#c9c8d6]">orang dari {number(guests.length)} undangan</span>
        </Card>
        <Stat label="Pihak pria" value={pria} quota={w.quotaGroom} />
        <Stat label="Pihak wanita" value={wanita} quota={w.quotaBride} />
        <Card className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted">Undangan terkirim</span>
          <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em]">{number(sent)}</span>
          <span className="text-[12px] text-muted">dari {number(guests.length)} undangan</span>
        </Card>
      </div>

      {(overPria > 0 || overWanita > 0) && (
        <Note title="Kuota terlampaui">
          {overPria > 0 && <p>Pihak pria melebihi kuota {number(overPria)} orang.</p>}
          {overWanita > 0 && <p>Pihak wanita melebihi kuota {number(overWanita)} orang.</p>}
          <p>Kurangi tamu atau naikkan kuota di Pengaturan, lalu sesuaikan pesanan catering.</p>
        </Note>
      )}

      <GuestManager guests={guests} />
    </>
  );
}

function Stat({ label, value, quota }: { label: string; value: number; quota: number }) {
  const over = value > quota;
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={cx("text-[28px] font-extrabold leading-none tracking-[-0.02em]", over && "text-warn-fg")}>{number(value)}</span>
      <span className={cx("text-[12px]", over ? "font-bold text-warn-fg" : "text-muted")}>
        {over ? `Lewat kuota ${number(quota)}` : `Kuota ${number(quota)} orang`}
      </span>
      <Progress value={quota ? (value / quota) * 100 : 0} label={`${label} terhadap kuota`} className="mt-1" />
    </Card>
  );
}
