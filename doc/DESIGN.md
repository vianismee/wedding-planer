# DESIGN.md — Wedding Planner (nama kerja: "Rukun")

Sumber kebenaran untuk keputusan visual dan UI. Setiap keputusan di sini punya alasan. Kalau sebuah komponen baru tidak cocok dengan aturan di bawah, ubah dokumen ini dulu, baru ubah kodenya.

Stack: Next.js (App Router), Tailwind CSS, shadcn/ui, lucide-react.
Prototype referensi: artifact "Wedding Planner Dashboard" (desktop, mobile, dan 7 halaman).

---

## 1. Karakter produk

Alat kerja untuk pasangan dan keluarga besar yang sedang mengurus pernikahan dengan banyak rangkaian adat. Penggunanya beragam: pengantin usia 25–35 yang terbiasa dengan aplikasi, sampai orang tua yang membuka dari HP Android kelas menengah.

Maka produk ini harus terasa:

- **Tenang dan teratur, bukan meriah.** Pernikahan sudah cukup ramai. Layar yang rapi menurunkan stres.
- **Jelas untuk dua generasi.** Teks cukup besar, label eksplisit, tanpa ikon tanpa label untuk aksi penting.
- **Indonesia, bukan terjemahan.** Istilah lokal dipakai apa adanya: seserahan, among tamu, sinoman, paes, ngunduh mantu.

Bukan karakter produk ini: estetika "AI startup" (gradien ungu, glow, glassmorphism), nuansa undangan pernikahan yang berlebihan (script font, bunga, emas mengilap).

---

## 2. Warna

Palet aktif: 1 netral gelap (ink), 1 netral terang (ground), 1 aksen, ditambah 3 warna pastel yang **hanya** dipakai sebagai latar label status dan chip ikon.

| Token | Hex | Peran |
|---|---|---|
| `ink` | `#1C1B29` | Teks utama, sidebar, capsule nav, tombol utama, kartu sorotan (hitung mundur) |
| `ground` | `#F2F1F6` | Latar halaman, latar input, isi tab nonaktif |
| `surface` | `#FFFFFF` | Kartu dan panel |
| `surface-sunken` | `#F7F6FA` | Kartu di dalam kartu (misal kolom penawaran) |
| `muted` | `#5E5D70` | Teks sekunder, label, metadata (kontras 6,1:1 di atas putih) |
| `line` | `#E3E2EA` | Garis tabel dan pemisah |
| `accent` | `#D6F06B` | Lihat aturan aksen di bawah |
| `ok-bg` / `ok-fg` | `#EEF7CC` / `#3D5A0C` | Status selesai, lunas, lengkap |
| `info-bg` / `info-fg` | `#E7E4FB` / `#3B2F8F` | Status berjalan: diproses, DP, persiapan |
| `warn-bg` / `warn-fg` | `#FCE5D8` / `#8A3B12` | Status perlu tindakan: jatuh tempo, belum, kurang |
| `note-bg` / `note-fg` | `#FBF0D9` / `#6B4A12` | Catatan sistem, misalnya label "Data contoh" |

### Aturan aksen

Aksen lime hanya muncul di tempat-tempat ini:

1. Item navigasi aktif (sidebar dan capsule).
2. Status "dipilih" pada sebuah pilihan, misalnya penawaran vendor yang dipilih atau tanggal akad di kalender.
3. Maksimal satu sorotan data per layar, misalnya bar kategori yang sedang dibahas.

Aksen **tidak** dipakai untuk tombol utama (pakai `ink`), latar kartu, ikon dekoratif, atau border. Alasannya: kalau aksen muncul di mana-mana, ia tidak lagi menunjuk apa pun.

Aksen bisa diganti per pasangan (lime, rose `#F6C9D0`, sage `#BFE3CF`, gold `#F5D78E`). Semua pilihan ini harus lolos kontras 4,5:1 untuk teks `ink` di atasnya.

### Tema

Untuk MVP hanya tema terang. Alasannya: aplikasi banyak dibuka di siang hari, di lokasi survey atau gedung, oleh pengguna lintas usia. Sidebar gelap adalah permukaan navigasi, bukan tema gelap. Dark mode masuk backlog setelah MVP.

### CSS variables (shadcn)

```css
:root {
  --background: #F2F1F6;
  --foreground: #1C1B29;
  --card: #FFFFFF;
  --card-foreground: #1C1B29;
  --muted: #F2F1F6;
  --muted-foreground: #5E5D70;
  --border: #E3E2EA;
  --input: #E3E2EA;
  --ring: #1C1B29;
  --primary: #1C1B29;
  --primary-foreground: #FFFFFF;
  --secondary: #FFFFFF;
  --secondary-foreground: #1C1B29;
  --accent: #D6F06B;
  --accent-foreground: #1C1B29;
  --destructive: #B42318;
  --radius: 12px;

  --status-ok-bg: #EEF7CC;   --status-ok-fg: #3D5A0C;
  --status-info-bg: #E7E4FB; --status-info-fg: #3B2F8F;
  --status-warn-bg: #FCE5D8; --status-warn-fg: #8A3B12;
  --note-bg: #FBF0D9;        --note-fg: #6B4A12;
  --surface-sunken: #F7F6FA;
}
```

---

## 3. Tipografi

**Plus Jakarta Sans** (Google Fonts, weight 400/500/600/700/800). Fallback: `'Segoe UI', system-ui, sans-serif`.

Alasan: huruf ini dirancang oleh studio Indonesia (Tokotype) untuk identitas kota Jakarta. Bentuknya geometris tapi hangat, angkanya jelas untuk nominal rupiah, dan tetap terbaca di ukuran kecil.

| Peran | Ukuran / line-height | Weight |
|---|---|---|
| Judul halaman (H1) | 28 / 1.2, tracking -0.02em | 800 |
| Judul seksi (H2) | 18–20 / 1.3 | 700–800 |
| Angka utama (harga, hitung mundur) | 24–34 / 1.1, tracking -0.02em | 800 |
| Isi | 14 / 1.5 | 400–600 |
| Isi padat (tabel, kartu) | 13 / 1.45 | 500–700 |
| Label & metadata | 11–12 / 1.4 | 600 |

Aturan:

- **Sentence case** di semua label, judul, dan tombol. Tidak ada label kapital dengan letter-spacing lebar.
- Ukuran minimum 11px, hanya untuk label. Isi tidak pernah di bawah 13px.
- Tidak ada monospace sebagai gaya.

---

## 4. Spasi, radius, bayangan

**Skala spasi (px):** 4, 6, 8, 10, 12, 14, 16, 20, 24, 28.
Jarak antar-seksi (24–28) selalu lebih besar dari jarak di dalam seksi (10–16), supaya pengelompokan terbaca tanpa garis.

**Radius.** Hanya set ini, dipakai sesuai peran:

| Radius | Untuk |
|---|---|
| 6px | Label status, catatan kecil |
| 10–12px | Tombol, input, tab segmented, chip ikon |
| 18–24px | Kartu, panel, sidebar (28px) |
| 999px | **Hanya** capsule nav dan item aktifnya, avatar, dan titik indikator |

Tombol bukan pill. Pill disimpan untuk capsule nav supaya ia tetap jadi elemen paling khas.

**Bayangan.** Hanya untuk elemen yang benar-benar melayang di atas konten:

- Capsule nav mobile: `0 10px 30px rgba(28, 27, 41, 0.28)`
- Action bar mobile (di atas capsule): `0 8px 24px rgba(28, 27, 41, 0.16)`

Kartu tidak diberi bayangan. Kartu dibedakan dari latar lewat warna (`surface` di atas `ground`).

---

## 5. Layout & breakpoint

| Lebar | Navigasi | Grid |
|---|---|---|
| ≥ 1200px | Sidebar 236px | Konten + kolom kanan 320–380px |
| 900–1199px | Sidebar 236px | Kolom kanan turun ke bawah |
| < 900px | **Capsule bar**, sidebar disembunyikan | Satu kolom, padding bawah 120px |
| < 720px | Capsule bar | Kartu horizontal jadi scroll-snap, pencarian header disembunyikan |

### Capsule bar (navigasi mobile)

- `position: fixed`, tengah, `bottom: 16px + env(safe-area-inset-bottom)`.
- Latar `ink`, padding 8px, jarak antar item 4px.
- Maksimal 5 item: Beranda, Acara, Tamu, Budget, Lainnya. Halaman lain masuk ke "Lainnya" (sheet berisi Vendor, Checklist, Seserahan, Moodboard, Dokumen, Pengaturan).
- Moodboard hanya untuk layar ≥ 768px (tablet dan web): tidak bisa dipasang di capsule, di "Lainnya" disembunyikan di bawah 768px, dan halamannya di HP hanya menampilkan penjelasan. Alasannya: menyusun dan menyambung foto butuh layar lebar.
- Item nonaktif: lingkaran 48×48, hanya ikon, wajib `aria-label`.
- Item aktif: melebar, latar aksen, ikon dan label teks, `aria-current="page"`.
- Transisi lebar 200ms ease. Tanpa animasi lain.
- Bila ada action bar kontekstual (misalnya "Simpan pilihan"), action bar muncul 96px di atas dasar layar, di atas capsule, bukan menggantikannya.

---

## 6. Komponen

### Tombol

| Varian | Tampilan | Kapan |
|---|---|---|
| Primary | Latar `ink`, teks putih, radius 12, tinggi 44 | Satu aksi utama per area |
| Secondary | Latar putih atau `ground`, teks `ink` | Aksi pendamping |
| Outline | Border `#C9C8D6`, transparan | Membatalkan pilihan |
| Disabled | Border `#D9D8E4`, teks `muted`, ditambah keterangan "(segera hadir)" bila fitur belum ada | Fitur belum dibangun |

Tidak ada panah dekoratif di tombol. Panah hanya dipakai bila aksinya memang memindahkan pengguna ke tempat lain.

### Label status

Radius 6, padding 3–5px × 7–10px, teks 11px weight 700. Warnanya mengikuti tiga semantik (`ok`, `info`, `warn`) ditambah netral (`ground`). Teks label menyebut keadaannya secara spesifik: "5 hari lagi", "DP 30%", "Diproses". Hindari label generik seperti "Pending".

### Kartu

Latar `surface`, radius 20–24, padding 18–22, tanpa border dan tanpa bayangan. Kartu sorotan (maksimal satu per layar) memakai latar `ink` dengan teks putih.

Jangan membuat grid kartu yang identik untuk konten yang punya bobot berbeda. Contoh: vendor yang sudah dipesan ditampilkan sebagai tabel, sedangkan penawaran yang sedang dibandingkan ditampilkan sebagai kolom.

### Tabel

- Kolom dipilih dari keputusan yang diambil pengguna di tabel itu. Kolom penentu diletakkan di depan. Contoh: tabel vendor diurutkan dan diawali dengan "Pembayaran berikutnya".
- Header 12px weight 600 warna `muted`, sentence case.
- Di layar sempit, tabel di-scroll dalam wadahnya sendiri (`overflow-x: auto`). Untuk daftar penting di mobile, ganti tabel dengan kartu bertumpuk.

### Tab segmented

Wadah `ground` dengan padding 4. Tab aktif berlatar `ink` dan teks putih. Jumlah item (misal "3 penawaran") ditulis di baris atau span terpisah, bukan digabung dengan tanda titik tengah.

### Perbandingan penawaran (pola khusus)

- Satu calon vendor dicatat sekali (kontak, ketersediaan, DP bawaan) dan punya beberapa paket. Paket boleh punya DP sendiri.
- Setiap calon vendor tampil sebagai satu kartu. Paketnya berupa baris ringkas (nama, total, jumlah isi, beda singkat seperti "+E"), bukan tabel. "Lihat isi paket" membuka detail tiap paket sebagai blok berjajar: rincian harga, DP, dan isi.
- Isi paket dicocokkan antar paket (huruf besar, spasi, dan tanda baca di ujung diabaikan). Di detail, isi yang tidak dimiliki semua paket ditandai "+", dan isi paket lain yang tidak termasuk ditulis pudar di bawahnya. Menyalin paket menjaga teks isinya sama supaya pencocokan akurat.
- Paket dari beberapa vendor dalam satu kategori bisa dicentang (maksimal 4) lalu dibandingkan sebagai blok detail berjajar di dialog lebar.
- Selisih terhadap alokasi budget dihitung otomatis dan diberi warna: hijau bila di bawah alokasi, oranye-coklat bila di atas. Hanya tampil untuk yang boleh melihat Budget.
- Label "Termurah" juga dihitung, bukan ditulis tangan. Paket yang sudah dipesan diberi label "Dipesan".

### Moodboard (pola khusus)

- Kanvas bebas berisi kartu foto, catatan, dan palet, dengan kelompok bernama dan sambungan berlabel. Tiga papan: Konsep utama, Akad, Resepsi.
- Layar penuh tanpa sidebar dan capsule (route group `(fokus)`). Tombol "Dashboard" di pojok kiri atas menjadi jalan kembali.
- Tata letak seperti Figma: panel Layer di kiri (bisa ditutup, tertutup otomatis di bawah 1280px), kanvas di tengah dengan toolbar alat melayang di bawah, dan panel Properti di kanan. Toolbar bawah hanya ikon; nama dan pintasan ada di tooltip dan label aksesibel. Petunjuk alat dan pengaturan alat bertumpuk tepat di atas toolbar.
- Dua cara mengelompokkan, mengikuti Figma. **Section** (dulu "Kelompok"): area berwarna, isinya mengikuti posisi di kanvas. **Frame**: seperti kertas berukuran pasti dengan latar sendiri; isinya tersimpan (elemen masuk saat dilepas di atas frame dan keluar saat diseret keluar), bagian yang keluar tepi terpotong, bisa bersarang, dan bisa diunduh jadi PNG. Ukuran siap pakai: post dan story Instagram, undangan A5, foto 4R, A4, dan presentasi 16:9 (ukuran cetak 150 dpi).
- Nama frame ditulis kecil `muted` di atas sudut kirinya, ukurannya tetap di layar berapa pun zoom-nya. Frame di kanvas dipilih lewat namanya; menarik di latarnya memilih isinya.
- Panel Layer: section dan frame tampil seperti folder berisi elemen di dalamnya, urutan dari atas sama dengan tumpukan di kanvas. Ikon mata dan gembok hanya muncul saat hover, dan tetap terlihat saat aktif.
- Panel Properti dibagi per bagian dengan judul kecil `muted` dan garis tipis: Posisi dan ukuran, isi khusus per jenis elemen, Tag, Sambungan, Susun, lalu Hapus paling bawah.
- Foto di kartu bisa "Isi kartu" (dipotong mengikuti titik fokus yang dipilih) atau "Utuh". Foto dibuka penuh lewat klik dua kali, tombol perbesar di pojok kartu, atau "Lihat foto penuh" di panel.
- Latar titik pada kanvas ikut bergeser dan membesar: penanda bahwa area itu bisa digeser dan di-zoom. Titik tidak dipakai di halaman lain.
- Alat aktif memakai aksen (status "dipilih"). Kartu terpilih memakai border `ink` 2px.
- Kartu palet memakai `BrandingCard` dari 21st.dev (`components/ui/color-palette.tsx`) tanpa animasi masuk, tanpa efek melayang saat hover, dan tanpa label kapital berjarak lebar. "Aa" ditulis dengan warna tergelap palet bila kontrasnya di atas putih minimal 3:1.
- Pipet (I) mengambil warna dari foto, video, dan elemen di kanvas, dengan contoh warna di samping kursor. Warna yang diambil berkumpul di bar atas toolbar: klik untuk menyalin kodenya, atau jadikan palet, tambahkan ke palet terpilih, dan warnai elemen terpilih.
- Pemilih warna memakai Cromia dari 21st.dev (`components/ui/cromia-color-picker.tsx`, dibungkus `components/color-field.tsx`). Tanpa kanal alpha karena warna palet disimpan sebagai hex 6 digit; warna cepat diambil dari palet lain di papan yang sama.
- Semua aksi punya jalur keyboard: daftar elemen di panel Layer, menyambung lewat pilihan kartu di panel Properti, angka X/Y/L/T, tombol panah untuk menggeser, Ctrl+G dan Ctrl+Shift+G untuk kelompok, Ctrl+] dan Ctrl+[ untuk urutan lapisan.
- Tag bawaan hanya saran. Anggota bisa menambah tag sendiri; tag yang tidak dipakai kartu mana pun hilang dari daftar.
- Simpan otomatis 800ms setelah perubahan. Bila anggota lain sudah menyimpan papan yang sama, simpanan ditolak dan pengguna diminta memuat ulang, bukan ditimpa diam-diam.

### Akses hanya lihat

Izin tiap anggota diatur per halaman (Tidak ada, Lihat, Ubah) di Pengaturan. Untuk anggota yang hanya boleh melihat, halaman tampil seperti biasa tanpa tombol tambah, ubah, dan hapus, dengan satu baris `ViewOnly` di bawah judul. Jangan menampilkan tombol yang pasti ditolak server. Data dari halaman lain (misalnya alokasi budget di Catering dan Vendor, atau ringkasan tamu di Beranda) hanya tampil bila halaman asalnya boleh dilihat.

### Empty state

Selalu menyebut sebab dan satu aksi. Contoh: "Belum ada penawaran untuk Souvenir. Tambahkan penawaran pertama untuk mulai membandingkan." Jangan hanya menulis "Tidak ada data".

---

## 7. Konten & penulisan

- **Jangan pakai " · " sebagai pemisah serba guna.** Pecah informasi menjadi pasangan label dan nilai, baris terpisah, atau kalimat biasa. Contoh: bukan "Kapasitas 1.000 · resepsi 14 Feb", melainkan judul "Gedung A" dengan keterangan "Kapasitas 1.000 tamu".
- **Tanggal:** `Sab, 13 Feb 2027` di kartu, `Sabtu, 13 Februari 2027` di judul. Jam memakai titik dan zona waktu bila perlu: `08.00 WIB`.
- **Rupiah:** ringkas di dashboard (`Rp 35 jt`, `Rp 3,5 jt`), lengkap di form dan bukti bayar (`Rp 35.000.000`). Desimal pakai koma.
- **Bahasa:** Indonesia sehari-hari yang sopan. Sapa pengguna dengan nama, tanpa "Anda" yang kaku. Istilah adat tidak diterjemahkan.
- **Tanpa emoji** di UI.
- **Data contoh harus berlabel.** Nama dan angka dummy memakai placeholder yang jelas (Vendor A, `[No. WhatsApp]`), disertai label "Data contoh" yang terlihat di halaman.

---

## 8. Ikon

lucide-react (bawaan shadcn), stroke 2, ukuran 18px di nav dan 20px di capsule. Ikon dipilih karena relevan dengan isinya, bukan untuk dekorasi:

- Kalender untuk acara, orang untuk tamu, dompet untuk budget, toko untuk vendor, kado untuk seserahan, dokumen untuk dokumen nikah.
- **Dilarang:** sparkle, bintang, petir, berlian, atau robot sebagai ikon fitur. Resepsi dan template adat perlu ikon yang lebih spesifik, atau tidak pakai ikon sama sekali.
- Ikon di dalam chip pastel hanya dipakai di daftar yang memang dipindai berdasarkan kategori, misalnya agenda dan pembayaran.

---

## 9. Motion

- Hanya ada respons hover dan press (150ms), transisi lebar capsule (200ms), dan munculnya action bar (200ms, naik 8px).
- Tidak ada animasi berulang, pulse, atau animasi masuk bertumpuk.
- Hormati `prefers-reduced-motion`: semua transisi menjadi 0ms.

---

## 10. Aksesibilitas

- Kontras teks minimal 4,5:1. Semua pasangan token di atas sudah lolos.
- Target sentuh minimal 44×44px. Item capsule berukuran 48px.
- Fokus terlihat: outline 2px `ink` dengan offset 2px, termasuk di atas latar aksen.
- Navigasi memakai `aria-current="page"`. Tombol toggle memakai `aria-pressed`. Ikon tanpa teks wajib punya `aria-label`.
- Semua alur bisa diselesaikan dengan keyboard saja.

---

## 11. Checklist sebelum merge UI

- [ ] Aksen hanya dipakai di nav aktif, status "dipilih", atau satu sorotan data.
- [ ] Tidak ada " · " sebagai pemisah serba guna.
- [ ] Tidak ada label kapital dengan letter-spacing lebar, tidak ada emoji.
- [ ] Radius sesuai tabel. Pill hanya untuk capsule nav dan avatar.
- [ ] Bayangan hanya untuk elemen yang melayang.
- [ ] Setiap tombol punya aksi nyata, atau dinonaktifkan dengan keterangan "segera hadir".
- [ ] Angka dan nama adalah data asli, atau placeholder berlabel.
- [ ] Empty, loading, dan error state menyebut sebab dan aksi berikutnya.
- [ ] Lolos cek di 390px, 900px, dan 1440px, serta bisa dipakai dengan keyboard saja.
