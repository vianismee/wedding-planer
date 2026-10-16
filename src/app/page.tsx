import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, FileText, Gift, ListChecks, Store, Users, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";

const FEATURES = [
  { icon: CalendarDays, title: "Rangkaian acara sesuai adat", text: "Jawa, Sunda, atau nasional, lengkap dengan rundown yang bisa dibagikan ke panitia." },
  { icon: Users, title: "Daftar tamu per pihak", text: "Kuota keluarga pria dan wanita, import dari Excel, dan estimasi porsi catering." },
  { icon: Wallet, title: "Budget dan termin", text: "Anggaran per kategori, sumber dana tiap keluarga, dan pengingat DP sebelum jatuh tempo." },
  { icon: Store, title: "Bandingkan penawaran vendor", text: "Selisih terhadap alokasi dan penawaran termurah dihitung otomatis." },
  { icon: ListChecks, title: "Checklist mundur dari akad", text: "Tugas tersusun per rentang waktu dan bergeser bila tanggal akad berubah." },
  { icon: Gift, title: "Seserahan dan mahar", text: "Status beli, harga, dan siapa yang mengurus tiap item." },
  { icon: FileText, title: "Dokumen nikah", text: "Checklist KUA atau Dukcapil per calon pengantin, dengan scan yang disimpan privat." },
];

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-10 px-4 py-6 sm:py-10">
      <nav className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6F06B" strokeWidth="2.2">
              <circle cx="9" cy="13" r="5" />
              <circle cx="15" cy="13" r="5" />
            </svg>
          </span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">Rukun</span>
        </span>
        <Link href="/masuk" className="inline-flex h-11 items-center rounded-xl px-4 text-[14px] font-bold no-underline hover:bg-surface">
          Masuk
        </Link>
      </nav>

      <section className="on-ink flex flex-col gap-5 rounded-[28px] bg-ink p-6 text-white sm:p-10">
        <h1 className="max-w-[720px] text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
          Satu tempat untuk mengurus pernikahan bersama keluarga.
        </h1>
        <p className="max-w-[600px] text-[16px] leading-[1.5] text-[#d9d8e4]">
          Rangkaian adat, ratusan tamu dari dua keluarga, termin vendor, dan dokumen KUA. Tidak lagi tersebar di grup WhatsApp, Excel, dan
          catatan orang tua.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/masuk"
            className="inline-flex h-12 items-center rounded-xl bg-white px-5 text-[14px] font-bold text-ink no-underline hover:bg-[#ececf3]"
          >
            Mulai gratis
          </Link>
        </div>
      </section>

      <section aria-labelledby="fitur" className="flex flex-col gap-4">
        <h2 id="fitur" className="text-[20px] font-extrabold">
          Isi ruang kerjanya
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[960px]:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.title} className="flex flex-col gap-2 rounded-[22px] bg-surface p-5">
                <Icon size={20} aria-hidden="true" />
                <h3 className="text-[15px] font-bold">{f.title}</h3>
                <p className="text-[13px] text-muted">{f.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="flex flex-wrap gap-4 border-t border-line pt-6 text-[13px] text-muted">
        <span>Rukun, nama kerja</span>
        <Link href="/privasi">Kebijakan privasi</Link>
      </footer>
    </main>
  );
}
