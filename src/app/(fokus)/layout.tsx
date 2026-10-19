import { redirect } from "next/navigation";
import { getContext, getSession } from "@/lib/session";

// Layout layar penuh untuk alat kerja yang butuh ruang lebar (Moodboard):
// tanpa sidebar dan capsule, navigasi kembali ada di pojok kiri atas halaman.
// Tanpa LiveRefresh: moodboard punya aliran realtime sendiri (/api/moodboard/live).
export default async function FokusLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSession())) redirect("/masuk");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");

  return (
    <main id="konten" className="min-h-dvh p-3" style={{ ["--accent" as string]: ctx.wedding.accent }}>
      {children}
    </main>
  );
}
