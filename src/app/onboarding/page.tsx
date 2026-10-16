import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext, getSession } from "@/lib/session";
import { pendingInviteFor } from "@/lib/invites";
import { ROLE_HELP, ROLE_LABEL, type Role } from "@/lib/roles";
import { AcceptButton } from "../undangan/[token]/accept";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Buat ruang pernikahan" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ baru?: string; abaikan?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/masuk?next=/onboarding");
  const { baru, abaikan } = await searchParams;
  if (!baru && (await getContext())) redirect("/dashboard");
  const name = session.user.name && session.user.name !== session.user.email ? session.user.name : "";

  // Tamu yang diundang tapi tersesat ke onboarding: tawarkan undangannya dulu.
  const pending = !abaikan ? await pendingInviteFor(session.user.email) : null;
  if (pending) {
    const role = pending.invite.role as Exclude<Role, "pemilik">;
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex w-full max-w-[460px] flex-col gap-5 rounded-[24px] bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-muted">Kamu punya undangan</p>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
              Persiapan pernikahan {pending.wedding.groomName} dan {pending.wedding.brideName}
            </h1>
          </div>
          <div className="rounded-[18px] bg-sunken p-4 text-[14px]">
            <p>
              Kamu diundang sebagai <strong>{ROLE_LABEL[role]}</strong>.
            </p>
            <p className="text-muted">{ROLE_HELP[role]}</p>
          </div>
          <AcceptButton token={pending.invite.token} email={session.user.email} />
          <Link href={`/onboarding?abaikan=1${baru ? "&baru=1" : ""}`} className="text-center text-[13px] font-semibold underline">
            Bukan ini, saya ingin membuat ruang pernikahan sendiri
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-start justify-center p-4 sm:items-center">
      <Wizard defaultName={name} />
    </main>
  );
}
