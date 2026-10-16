# Rukun — wedding planner (MVP)

Web app (PWA) untuk pasangan dan keluarga yang mengurus pernikahan sendiri. Spesifikasi di `doc/PRD MVP — Wedding Planner (Rukun).md`, aturan visual di `doc/DESIGN.md`.

Stack: Next.js 16 (App Router), Tailwind 4, lucide-react, Better Auth (OTP email + Google), Drizzle ORM (PostgreSQL 16, atau PGlite untuk dev), MinIO/S3, BullMQ.

## Menjalankan di lokal

```bash
npm install
cp .env.example .env      # isi BETTER_AUTH_SECRET dan CRON_SECRET
npm run dev               # http://localhost:3000
```

Tanpa `DATABASE_URL`, database memakai PGlite di `.data/pglite` dan migrasi berjalan otomatis. Tanpa `SMTP_URL`, kode OTP dan email lain dicetak ke log server. Tanpa `S3_ENDPOINT`, file disimpan di `.data/uploads`.

Worker pengingat termin (H-7 dan H-1): `npm run worker` (perlu server berjalan dan `CRON_SECRET`).

## Modul

| Halaman | Isi |
| --- | --- |
| `/onboarding` | 4 layar: pasangan, tanggal akad dan kota, template adat (akad dan resepsi terpisah) dan agama, ringkasan dan budget. Acara, rundown, checklist, seserahan, kategori budget, dan dokumen terisi dari template. |
| `/dashboard` | Hitung mundur, acara terdekat, budget per kategori, agenda 7 hari, pembayaran terdekat, progres. Kalender menandai acara, jatuh tempo pembayaran, dan jadwal kustom (test food, fitting, survey, meeting vendor) yang bisa ditambah, diubah, dihapus. |
| `/acara` | Tambah, ubah, hapus, urutkan acara. Tombol "Dari template": kembalikan acara dari template adat (dengan atau tanpa rundown), termasuk pilihan akad dan resepsi dalam satu acara, atau isi rundown saja (tambahkan atau ganti). Rundown per acara dengan PIC. Link rundown baca-saja `/r/[token]` (rate limited). |
| `/jadwal` | Jadwal kustom di luar rangkaian acara (test food, fitting, survey lokasi, meeting vendor, lainnya): per tanggal, filter jenis, akan datang atau sudah lewat, vendor terkait, tanggal dan waktu dalam satu pemilih. |
| `/tamu` | Tamu per pihak, kategori, sesi, jumlah orang. Kuota per pihak, porsi catering, import Excel/CSV dengan pratinjau dan deteksi duplikat, ekspor CSV. |
| `/budget` | Anggaran per kategori, sumber dana, pengeluaran dengan foto bukti, termin vendor dan tandai lunas. |
| `/catering` | Kalkulator konsumsi: vendor per pax atau masak sendiri (bahan per porsi, juru masak x upah x hari, alat), jumlah porsi dari daftar tamu plus cadangan, bandingkan skenario, jadikan anggaran Catering. |
| `/vendor` | Perbandingan penawaran per kategori: DP persen, nominal, atau tanpa DP; harga paket, isi paket berupa daftar, add-on di luar paket (nama, jumlah, harga) dengan total otomatis. Selisih alokasi, termurah, dan DP dihitung dari total. Memilih penawaran membuat vendor terpesan plus termin DP dan pelunasan. Tabel vendor urut pembayaran terdekat. |
| `/v/[token]` | Link baca-saja untuk vendor: ringkasan pesanan, isi paket dan add-on, jadwal pembayaran beserta statusnya, rangkaian acara, dan janji temu dengan vendor itu. Dibuat dan dicabut dari detail vendor. |
| `/checklist` | Tugas per rentang waktu mundur dari akad, PIC, penugasan ke anggota. Tenggat disimpan relatif ke akad sehingga ikut bergeser. |
| `/seserahan` | Item per kategori dengan status, harga, PIC. Mahar terpisah. |
| `/dokumen` | Checklist per calon pengantin, jalur KUA atau Dukcapil, upload scan privat, hapus permanen. |
| `/pengaturan` | Data pernikahan, aksen, kuota, anggota (maks 10) dan undangan via link/email, peran, hapus ruang pernikahan. |

## Peran

Dicek di server untuk setiap aksi (`src/lib/roles.ts`, `requireAction`).

- Pemilik dan Pasangan: akses penuh.
- Keluarga: dashboard tanpa angka uang, acara (lihat), tamu, checklist, seserahan.
- Panitia: rundown dan tugasnya sendiri.

## Tidak termasuk

Pembayaran dan paywall (sesuai permintaan, semua fitur terbuka; kolom `wedding.payment_status` disiapkan). Non-goal PRD lain: undangan digital, RSVP, buku tamu, WhatsApp, dark mode.

## Deploy (1 VPS)

```bash
cp .env.example .env   # isi juga DOMAIN, POSTGRES_PASSWORD, MINIO_*
docker compose up -d --build
```

Migrasi database berjalan otomatis saat app start. Backup harian PostgreSQL dan MinIO ke luar VPS masih perlu dipasang terpisah (PRD: keamanan dan privasi).
