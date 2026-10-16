import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await getSession()) redirect(safeNext);
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-[24px] bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6F06B" strokeWidth="2.2">
              <circle cx="9" cy="13" r="5" />
              <circle cx="15" cy="13" r="5" />
            </svg>
          </span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Rukun</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">Masuk atau daftar</h1>
          <p className="text-[14px] text-muted">
            Pakai kode dari email, atau daftar langsung dengan kata sandi.
          </p>
        </div>
        <LoginForm next={safeNext} google={googleEnabled} />
      </div>
    </main>
  );
}
