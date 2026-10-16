"use client";

import { Button } from "@/components/kit";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex max-w-[520px] flex-col gap-3 rounded-[22px] bg-surface p-6">
      <h1 className="text-[22px] font-extrabold">Halaman gagal dimuat</h1>
      <p className="text-[14px] text-muted">
        Biasanya karena koneksi terputus atau server sedang sibuk. Data kamu aman. Coba muat ulang.
      </p>
      <Button onClick={reset} className="self-start">
        Muat ulang
      </Button>
    </div>
  );
}
