import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContext, getSession } from "@/lib/session";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Buat ruang pernikahan" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/masuk?next=/onboarding");
  const { baru } = await searchParams;
  if (!baru && (await getContext())) redirect("/dashboard");
  const name = session.user.name && session.user.name !== session.user.email ? session.user.name : "";
  return (
    <main className="flex min-h-dvh items-start justify-center p-4 sm:items-center">
      <Wizard defaultName={name} />
    </main>
  );
}
