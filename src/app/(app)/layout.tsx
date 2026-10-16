import { redirect } from "next/navigation";
import { getContext, getSession } from "@/lib/session";
import { can } from "@/lib/roles";
import { Capsule, Sidebar, type NavId } from "@/components/nav";

const ORDER: NavId[] = ["dashboard", "acara", "jadwal", "tamu", "budget", "catering", "vendor", "checklist", "seserahan", "dokumen", "pengaturan"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSession())) redirect("/masuk");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");

  const items = ORDER.filter((id) => can(ctx.member.role, id));
  const weddingName = `${ctx.wedding.groomName} & ${ctx.wedding.brideName}`;

  return (
    <div
      className="flex min-h-dvh items-start gap-5 p-3 min-[900px]:p-4"
      style={{ ["--accent" as string]: ctx.wedding.accent }}
    >
      <Sidebar items={items} userName={ctx.user.name || ctx.user.email} weddingName={weddingName} />
      <main id="konten" className="flex min-w-0 flex-1 flex-col gap-6 px-1 pb-[120px] pt-1 min-[900px]:px-2 min-[900px]:pb-6 min-[900px]:pt-3">
        {children}
      </main>
      <Capsule items={items} saved={ctx.member.capsuleItems ?? null} />
    </div>
  );
}
