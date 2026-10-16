# PRD MVP — Wedding Planner (Rukun)

Oct 16, 2026 · @Vianismee

## Ringkasan eksekutif

MVP adalah web app (PWA) untuk pasangan yang mengurus pernikahan sendiri, dijual sekali bayar per pernikahan, dan live dalam 12 minggu.

**Masalah.** Pernikahan di Indonesia melibatkan banyak rangkaian acara adat, ratusan tamu dari dua keluarga, banyak vendor dengan termin pembayaran, dan dana dari beberapa pihak. Semuanya biasanya tersebar di grup WhatsApp, Excel, dan catatan ortu, sehingga sering ada yang terlewat.

**Solusi.** Satu ruang kerja bersama untuk pasangan dan keluarga. Isinya rangkaian acara sesuai adat, daftar tamu per pihak, budget dan termin vendor, perbandingan penawaran, checklist mundur dari tanggal akad, seserahan, dan dokumen KUA.

**Kriteria sukses.** Ini target awal, divalidasi ulang setelah 100 pasangan pertama.

| Metrik | Target | Diukur |
| --- | --- | --- |
| Aktivasi: isi tanggal akad, 1 acara, dan 20 tamu | 60% pasangan baru dalam 7 hari | Event onboarding |
| Kolaborasi: undang minimal 1 anggota keluarga | 40% pasangan aktif | Undangan diterima |
| Konversi berbayar | 8% pasangan aktif dalam 30 hari | Pembayaran sukses |
| Retensi berbayar | 50% masih aktif mingguan sampai H-7 | Sesi mingguan |
| Performa | p95 muat halaman di bawah 2,5 detik di 4G, Lighthouse accessibility minimal 95 | RUM dan Lighthouse CI |

## Persona

Pembeli adalah pasangan. Pengguna harian juga mencakup orang tua dan panitia, sehingga hak akses per peran wajib ada sejak MVP.

| Persona | Siapa | Kebutuhan utama | Perangkat |
| --- | --- | --- | --- |
| Calon pengantin (pemilik) | Usia 25–35, bekerja, mengurus sendiri tanpa WO penuh | Satu tempat untuk semua rencana, tahu apa yang harus dibayar dan dikerjakan minggu ini | Laptop dan HP |
| Orang tua | Usia 50–65, memegang daftar tamu keluarga dan sebagian dana | Menambah tamu tanpa repot, melihat kuota pihaknya | HP Android kelas menengah |
| Panitia keluarga | Saudara atau teman yang jadi among tamu, sinoman, penerima tamu | Melihat rundown dan tugasnya sendiri | HP |

Pembeli dan pemilik data adalah pasangan. Ortu dan panitia ikut tanpa biaya tambahan.

## Scope MVP

MVP berisi 9 modul yang semuanya sudah ada di prototype, ditambah onboarding dan pembayaran. Undangan digital dan fitur hari-H tidak termasuk.

1. **Onboarding dan ruang pernikahan**
   - Sebagai calon pengantin, saya ingin membuat ruang pernikahan dari tanggal akad dan adat yang dipakai, supaya rangkaian acara dan checklist langsung tersusun.
   - AC: daftar dengan email atau Google, lalu isi nama pasangan, tanggal akad, kota, dan template adat dalam maksimal 4 layar.
   - AC: template MVP ada 3, yaitu Jawa (Solo/Jogja), Sunda, dan nasional. Akad dan resepsi boleh memakai template berbeda.
   - AC: setelah onboarding, acara, checklist, dan seserahan bawaan template sudah terisi dan bisa diedit.
2. **Rangkaian acara dan rundown**
   - Sebagai calon pengantin, saya ingin mengatur setiap acara beserta rundown-nya, supaya keluarga tahu urutan dan PIC-nya.
   - AC: tambah, ubah, hapus, dan urutkan acara. Setiap acara punya tanggal, jam, lokasi, perkiraan tamu, dan status.
   - AC: rundown per acara berisi jam, kegiatan, dan PIC. Rundown bisa dibagikan sebagai link baca-saja tanpa login.
3. **Daftar tamu**
   - Sebagai orang tua, saya ingin menambah tamu pihak saya, supaya kuota keluarga terpantau.
   - AC: setiap tamu punya nama, kategori, pihak (pria/wanita), sesi, jumlah orang, cara kirim undangan, dan status.
   - AC: import dari Excel/CSV dengan pratinjau dan deteksi duplikat nama.
   - AC: kuota per pihak, peringatan saat melebihi kuota, dan estimasi porsi catering (jumlah orang, bukan jumlah undangan).
   - AC: daftar 1.500 tamu tetap bisa difilter dan dicari dalam waktu di bawah 300 ms.
4. **Budget dan termin**
   - Sebagai calon pengantin, saya ingin melihat anggaran, yang terpakai, dan yang sudah terikat termin, supaya tidak ada pembayaran yang mengejutkan.
   - AC: anggaran per kategori, sumber dana per pihak, dan pencatatan pengeluaran dengan bukti foto.
   - AC: termin vendor (DP, cicilan, pelunasan) lengkap dengan tanggal jatuh tempo. Pengingat email dikirim H-7 dan H-1.
5. **Vendor dan perbandingan penawaran**
   - Sebagai calon pengantin, saya ingin membandingkan penawaran dalam satu kategori terhadap alokasi budget, supaya bisa memutuskan dengan cepat.
   - AC: setiap penawaran memuat harga, isi paket, persentase DP, ketersediaan, catatan, dan lampiran.
   - AC: selisih terhadap alokasi dan label termurah dihitung otomatis.
   - AC: memilih penawaran mengubahnya menjadi vendor terpesan dan membuat termin DP di Budget.
   - AC: daftar vendor terpesan diurutkan dari pembayaran terdekat.
6. **Checklist**
   - Sebagai calon pengantin, saya ingin tugas tersusun mundur dari tanggal akad, supaya tahu apa yang dikerjakan sekarang.
   - AC: tugas dikelompokkan per rentang waktu. Setiap tugas punya PIC dan tenggat, dan bisa dicentang.
   - AC: tenggat ikut bergeser bila tanggal akad diubah.
7. **Seserahan dan mahar**
   - AC: item seserahan per kategori dengan status, harga, dan PIC. Mahar dicatat terpisah.
8. **Dokumen nikah**
   - AC: checklist dokumen per calon pengantin, jalur KUA atau Dukcapil sesuai agama yang dipilih, dan upload scan.
   - AC: menampilkan catatan bahwa persyaratan harus dikonfirmasi ke KUA setempat.
9. **Kolaborasi dan peran**
   - AC: pemilik mengundang anggota lewat link atau email, dengan peran Pasangan, Keluarga, atau Panitia.
   - AC: Keluarga bisa mengelola tamu dan checklist tetapi tidak melihat Budget. Panitia hanya melihat rundown dan tugasnya sendiri.
   - AC: maksimal 10 anggota per pernikahan.

**Dashboard.** Menampilkan hitung mundur, acara, budget terpakai, agenda 7 hari, pembayaran terdekat, dan progres. Semua angka dihitung dari data modul di atas, tidak ada angka statis.

**Navigasi.** Sidebar di layar 900 px ke atas, capsule bar di bawah 900 px, sesuai DESIGN.md.

## Non-goals MVP

Yang berikut sengaja ditunda supaya MVP selesai dalam 12 minggu.

| Ditunda | Alasan | Rencana |
| --- | --- | --- |
| Undangan digital, RSVP, blast WhatsApp | Butuh WhatsApp API, template desain, dan mitigasi risiko banned | v1.1 |
| Buku tamu QR dan buku amplop hari-H | Butuh mode offline dan sinkronisasi yang andal di gedung | v1.1 |
| Pengingat via WhatsApp | MVP cukup email dan notifikasi in-app | v1.1 |
| Template adat selain Jawa, Sunda, nasional | Konten perlu riset per adat | Bertahap mulai v1.1 |
| Marketplace atau direktori vendor | Butuh sisi supply dan kurasi | v2 |
| Mode WO multi-klien (B2B) | Target MVP adalah B2C | v2 |
| Aplikasi native iOS/Android | PWA sudah cukup untuk akses dari HP | Dievaluasi setelah v1.1 |
| Hitung hari baik (weton/primbon) | Fitur tambahan, bukan inti | Backlog |
| Dark mode | Lihat DESIGN.md | Backlog |

## Model bisnis

Pasangan bisa mulai gratis dengan batas, lalu membayar sekali untuk membuka semua fitur sampai 90 hari setelah acara terakhir.

|  | Gratis | Paket Pernikahan (sekali bayar) |
| --- | --- | --- |
| Tamu | Maksimal 100 | Tanpa batas |
| Anggota kolaborasi | Pasangan saja (2) | Maksimal 10 dengan peran |
| Acara dan rundown | Semua, rundown tidak bisa dibagikan | Link rundown untuk panitia |
| Import Excel tamu | Tidak | Ya |
| Perbandingan penawaran | 1 kategori | Semua kategori |
| Pengingat termin via email | Tidak | Ya |
| Masa aktif | Selama gratis | Sampai 90 hari setelah acara terakhir, lalu baca-saja dan bisa ekspor |

- **Harga:** belum diputuskan. Hipotesis awal Rp 149.000–249.000, divalidasi lewat wawancara dengan 10 pasangan sebelum minggu ke-8.
- **Pembayaran:** QRIS, virtual account, dan e-wallet melalui payment gateway lokal (Midtrans atau Xendit, dipilih di minggu ke-1).
- **Titik paywall:** muncul saat batas gratis tercapai, misalnya tamu ke-101 atau undang anggota ke-3. Tidak ada paywall di tengah onboarding.
- **Refund:** penuh dalam 7 hari bila belum melewati batas gratis.

## Spesifikasi teknis

Satu monolit Next.js di satu VPS dengan Docker Compose. Arsitektur ini cukup untuk ribuan pasangan dan mudah dioperasikan oleh satu developer.

&#91;embedded content: arsitektur MVP · 1 VPS, 3 layanan luar\]

Semua permintaan masuk lewat Caddy ke Next.js. Next.js menyimpan data di PostgreSQL, mengirim pekerjaan berat ke worker, dan menyimpan file di MinIO.

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Frontend | Next.js App Router, Tailwind, shadcn/ui, lucide-react | PWA (manifest dan service worker) agar bisa dipasang di HP |
| Auth | Better Auth: email dengan OTP, Google OAuth | Session cookie httpOnly |
| Database | PostgreSQL 16 dengan Drizzle ORM | Migrasi via drizzle-kit |
| Job | Redis dengan BullMQ | Pengingat termin, import Excel, email |
| File | MinIO (kompatibel S3) | URL bertanda tangan, berlaku 10 menit |
| Deploy | Docker Compose dan Caddy | CI GitHub Actions: build image lalu deploy via SSH |
| Observabilitas | Log terstruktur, Uptime Kuma, Sentry self-hosted atau free tier | Alert ke email |

**Model data inti.** `wedding` (tanggal akad, kota, template adat, status bayar), `member` (user, peran), `event` dan `rundown_item`, `guest` (pihak, kategori, sesi, jumlah orang), `budget_category`, `expense`, `funding_source`, `vendor`, `offer`, `payment_term`, `task`, `seserahan_item`, `mahar`, `document`. Semua tabel memiliki `wedding_id`, dan setiap query difilter berdasarkan anggota pernikahan itu.

**Keamanan dan privasi.**

- Otorisasi per peran dicek di server untuk setiap aksi, tidak hanya disembunyikan di UI.
- Scan dokumen (KTP, KK, akta) disimpan di bucket privat, dienkripsi saat disimpan, dan bisa dihapus permanen oleh pemilik.
- Data pribadi tamu dan dokumen tunduk pada UU PDP: kebijakan privasi, persetujuan saat daftar, dan ekspor serta hapus data sesuai permintaan.
- Webhook pembayaran diverifikasi lewat signature, dan status bayar hanya diubah dari webhook.
- Backup PostgreSQL dan MinIO setiap hari ke penyimpanan di luar VPS, disimpan 14 hari, dan diuji pemulihannya setiap bulan.
- Rate limit untuk login, OTP, dan link rundown publik.

## Metrik dan analytics

Analytics di-host sendiri di VPS (Umami atau PostHog self-hosted), tanpa data pribadi tamu di event.

| Event | Dipicu saat | Dipakai untuk |
| --- | --- | --- |
| `wedding_created` | Onboarding selesai | Jumlah pasangan baru |
| `activation_reached` | Tanggal akad, 1 acara, dan 20 tamu sudah terisi | Aktivasi 7 hari |
| `member_invited` / `member_joined` | Undangan dikirim / diterima | Kolaborasi |
| `guests_imported` | Import Excel berhasil | Adopsi import |
| `offer_compared` / `offer_chosen` | Membuka perbandingan / memilih penawaran | Nilai fitur vendor |
| `paywall_shown` / `payment_success` | Batas gratis tercapai / bayar sukses | Konversi |
| `weekly_active` | Sesi pertama dalam satu minggu | Retensi sampai H-7 |

Event hanya berisi id pernikahan, peran, dan hitungan (misal jumlah tamu). Nama, nomor HP, dan nominal tidak pernah dikirim ke analytics.

## Rencana rilis dan risiko

MVP dikerjakan dalam 6 sprint dua mingguan dan launch publik 12 minggu setelah mulai. Tanggal mulai 19 Okt 2026 masih asumsi.

&#91;embedded content: rencana MVP · 6 sprint, 1 launch\]

Beta tertutup dengan 20 pasangan berjalan bersamaan dengan sprint pembayaran, supaya alur bayar diuji oleh pengguna sungguhan sebelum launch.

**Syarat lolos beta ke launch:**

- [ ] Tidak ada bug kritis (kehilangan data, akses lintas pernikahan, pembayaran gagal tercatat) selama 7 hari terakhir beta.
- [ ] Minimal 12 dari 20 pasangan beta mencapai aktivasi.
- [ ] Minimal 5 pasangan beta membayar dengan harga final.
- [ ] Uji pemulihan backup berhasil.
- [ ] Kebijakan privasi dan syarat layanan sudah terbit.

**Risiko utama.**

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Scope 9 modul terlalu besar untuk 12 minggu | Launch mundur | Seserahan dan dokumen boleh dirilis versi sederhana. Perbandingan penawaran tidak boleh dipotong karena jadi pembeda |
| Verifikasi merchant payment gateway lama | Paywall belum bisa aktif saat launch | Ajukan di minggu ke-1. Fallback: transfer manual dengan konfirmasi admin |
| Konten template adat tidak akurat | Kepercayaan pengguna turun | Review oleh perias atau sesepuh sebelum beta, dan semua item bisa diedit pengguna |
| VPS tunggal down atau data hilang | Data pernikahan hilang | Backup harian off-site, uji pemulihan bulanan, monitoring uptime |
| Ortu kesulitan memakai aplikasi | Daftar tamu tetap di Excel | Import Excel, login OTP tanpa password, dan uji dengan 5 ortu saat beta |
| Kebocoran data KTP atau KK | Risiko hukum (UU PDP) | Bucket privat, URL bertanda tangan, akses hanya untuk peran Pasangan |

## Pertanyaan terbuka

- [ ] Nama produk final dan domain ("Rukun" masih nama kerja).
- [ ] Harga Paket Pernikahan, divalidasi lewat wawancara 10 pasangan.
- [ ] Midtrans atau Xendit: bandingkan biaya QRIS/VA dan kemudahan verifikasi merchant.
- [ ] Konten 3 template adat: siapa yang mereview (perias, MUA, atau sesepuh) supaya urutan acara dan seserahan akurat.
- [ ] Daftar persyaratan dokumen KUA dan Dukcapil: sumber resmi mana yang dipakai dan seberapa sering dicek ulang.
- [ ] Badan usaha dan kebijakan privasi: dibutuhkan untuk merchant payment gateway dan karena menyimpan data pribadi tamu (UU PDP).
- [ ] Ukuran VPS awal dan lokasi data center (Indonesia atau Singapura).
