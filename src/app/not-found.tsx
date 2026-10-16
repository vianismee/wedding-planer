import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex max-w-[420px] flex-col gap-3 rounded-[24px] bg-surface p-6">
        <h1 className="text-[24px] font-extrabold">Halaman tidak ditemukan</h1>
        <p className="text-[14px] text-muted">Link mungkin salah ketik atau sudah tidak berlaku.</p>
        <Link href="/dashboard" className="text-[14px] font-semibold underline">
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
