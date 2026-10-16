import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan privasi" };

// Draf kerja. Harus direview penasihat hukum sebelum beta (PRD: pertanyaan terbuka badan usaha dan kebijakan privasi).
export default function PrivasiPage() {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-10 text-[14px] leading-[1.6]">
      <p className="self-start rounded-md bg-note-bg px-2 py-1 text-[12px] font-bold text-note-fg">Draf, belum final</p>
      <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">Kebijakan privasi</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-bold">Data yang kami simpan</h2>
        <p>
          Nama dan email akun, data pernikahan (tanggal, acara, budget, vendor), daftar tamu yang kamu masukkan, serta scan dokumen nikah yang
          kamu unggah.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-bold">Cara kami melindunginya</h2>
        <p>
          Scan KTP, KK, dan akta disimpan di penyimpanan privat yang terenkripsi dan hanya bisa dibuka anggota berperan Pasangan. Analytics
          tidak pernah berisi nama, nomor HP, atau nominal.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-bold">Hak kamu</h2>
        <p>
          Sesuai UU Pelindungan Data Pribadi, kamu bisa mengekspor daftar tamu kapan saja dan pemilik bisa menghapus seluruh ruang pernikahan
          secara permanen dari halaman Pengaturan.
        </p>
      </section>
      <Link href="/" className="font-semibold underline">
        Kembali
      </Link>
    </main>
  );
}
