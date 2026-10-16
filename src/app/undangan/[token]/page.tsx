import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { findInvite } from "@/lib/invites";
import { ROLE_HELP, ROLE_LABEL, type Role } from "@/lib/roles";
import { buttonClass } from "@/components/kit";
import { AcceptButton, RememberInvite } from "./accept";

export const metadata: Metadata = { title: "Undangan bergabung", robots: { index: false } };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { token } = await params;
  const { auto } = await searchParams;
  const session = await getSession();
  const row = /^[a-f0-9]{32}$/.test(token) ? await findInvite(token) : null;
  // Setelah daftar atau masuk, kembali ke sini dan undangan langsung diterima.
  const back = encodeURIComponent(`/undangan/${token}?auto=1`);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[460px] flex-col gap-5 rounded-[24px] bg-surface p-6 sm:p-8">
        {!row ? (
          <>
            <h1 className="text-[24px] font-extrabold leading-tight">Undangan tidak berlaku</h1>
            <p className="text-[14px] text-muted">
              Link ini sudah dipakai, dibatalkan, atau lewat 14 hari. Minta link baru ke pengantin yang mengundangmu.
            </p>
            <Link href={session ? "/dashboard" : "/"} className="text-[14px] font-semibold underline">
              {session ? "Ke dashboard" : "Ke halaman utama"}
            </Link>
          </>
        ) : (
          <>
            <RememberInvite token={token} />
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
              {row.invite.email && <p className="mt-1 text-[13px] text-muted">Undangan ini untuk {row.invite.email}.</p>}
            </div>
            {session ? (
              <AcceptButton token={token} email={session.user.email} auto={auto === "1"} />
            ) : (
              <div className="flex flex-col gap-2">
                <Link href={`/masuk?mode=daftar&next=${back}`} className={buttonClass("primary")}>
                  Daftar dan bergabung
                </Link>
                <Link href={`/masuk?next=${back}`} className={buttonClass("ground")}>
                  Sudah punya akun? Masuk
                </Link>
                <p className="text-[12px] text-muted">Setelah daftar atau masuk, kamu langsung bergabung tanpa langkah tambahan.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
