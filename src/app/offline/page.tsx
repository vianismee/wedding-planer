import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tidak ada koneksi" };

// Ditampilkan service worker saat aplikasi dibuka tanpa internet.
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex max-w-[420px] flex-col gap-3 rounded-[24px] bg-surface p-6">
        <h1 className="text-[24px] font-extrabold">Tidak ada koneksi internet</h1>
        <p className="text-[14px] text-muted">
          Rukun butuh internet untuk memuat data terbaru. Data kamu aman. Coba lagi setelah sinyal kembali.
        </p>
        <a href="/dashboard" className="inline-flex h-11 items-center justify-center self-start rounded-xl bg-ink px-4 text-[13px] font-bold text-white no-underline">
          Coba lagi
        </a>
      </div>
    </main>
  );
}
