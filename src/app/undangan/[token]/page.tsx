import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSession } from "@/lib/session";
import { ROLE_HELP, ROLE_LABEL, type Role } from "@/lib/roles";
import { AcceptButton } from "./accept";

export const metadata: Metadata = { title: "Undangan bergabung", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  const [row] = await db
    .select({ invite: schema.invite, wedding: schema.wedding })
    .from(schema.invite)
    .innerJoin(schema.wedding, eq(schema.invite.weddingId, schema.wedding.id))
    .where(and(eq(schema.invite.token, token), isNull(schema.invite.acceptedAt), gt(schema.invite.expiresAt, new Date())));

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[460px] flex-col gap-5 rounded-[24px] bg-surface p-6 sm:p-8">
        {!row ? (
          <>
            <h1 className="text-[24px] font-extrabold leading-tight">Undangan tidak berlaku</h1>
            <p className="text-[14px] text-muted">
              Link ini sudah dipakai, dibatalkan, atau lewat 14 hari. Minta link baru ke pengantin yang mengundangmu.
            </p>
            <Link href="/" className="text-[14px] font-semibold underline">
              Ke halaman utama
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-muted">Undangan bergabung</p>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
                Persiapan pernikahan {row.wedding.groomName} dan {row.wedding.brideName}
              </h1>
            </div>
            <div className="rounded-[18px] bg-sunken p-4 text-[14px]">
              <p>
                Kamu diundang sebagai <strong>{ROLE_LABEL[row.invite.role as Role]}</strong>.
              </p>
              <p className="text-muted">{ROLE_HELP[row.invite.role as Exclude<Role, "pemilik">]}</p>
            </div>
            {session ? (
              <AcceptButton token={token} email={session.user.email} />
            ) : (
              <Link
                href={`/masuk?next=${encodeURIComponent(`/undangan/${token}`)}`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-4 text-[13px] font-bold text-white no-underline"
              >
                Masuk untuk bergabung
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
