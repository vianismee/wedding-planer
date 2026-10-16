# Tindak lanjut audit 001

Tanggal: 2026-10-16
Permintaan: menambahkan fitur dari moodboard (artboard "Moodboard, Tablet & web") dan memperbaiki UI/UX. Moodboard hanya untuk tablet dan web, dan tag bisa dibuat sendiri.

## Fitur baru: Moodboard

- Halaman `/moodboard` (`src/app/(app)/moodboard/`) dengan tiga papan: Konsep utama, Akad, Resepsi.
- Kartu foto, catatan, dan palet warna; kelompok bernama dengan lima warna latar; sambungan berlabel antar kartu; zoom, geser, paskan, cubit dua jari di tablet.
- Tag: tujuh tag bawaan sebagai saran, ditambah tag buatan anggota (maksimal 30 karakter, 12 per kartu).
- Data tersimpan di tabel `moodboard` (migrasi `drizzle/0011_moodboard.sql`), simpan otomatis dengan deteksi bentrok antar anggota (`rev`).
- Foto masuk penyimpanan privat lewat `/api/upload` (jenis `moodboard`, hanya JPG/PNG/WEBP). Foto yang sudah tidak dipakai di papan mana pun dihapus setelah sehari.
- Akses: Pemilik, Pasangan, Keluarga. Panitia tidak.
- HP (< 768px): halaman hanya menampilkan penjelasan, menu tidak muncul di Lainnya dan tidak bisa dipasang di capsule.

Perbedaan dari moodboard rujukan, dan alasannya:
- Data contoh (Pelaminan Jawa klasik dan sebagainya) tidak dibawa. Papan baru kosong dengan tombol "Buat kelompok awal" (R-38).
- "Section" menjadi "Kelompok" supaya konsisten dengan bahasa Indonesia di DESIGN.md.
- Tombol zoom 32px menjadi 40px dalam grup 48px, tombol detail 32px menjadi 40 sampai 44px (R-03).
- Jalur keyboard ditambah: daftar kartu, sambung lewat pilihan kartu, tombol panah (R-32).
- Kartu baru mencari tempat kosong, tidak menumpuk.

## Temuan audit yang diperbaiki

| No | Status | Perubahan |
|---|---|---|
| #1 | Diperbaiki | Isian, select, dan trigger tanggal mendapat border ink saat fokus (`globals.css`). |
| #2 | Diperbaiki | Placeholder `#8a899c` menjadi `#6b6a7d` (4,69:1 di atas ground). |
| #3 | Diperbaiki | Hari di luar bulan `#a9a8b8` menjadi `#757488` (4,56:1 di atas putih). |
| #4 | Diperbaiki sebagian | Utilitas `.hit-44` memperluas area sentuh tanpa mengubah tampilan: tombol `sm`, copy-link, tombol ikon tanggal dan file, filter checklist/jadwal/tamu, tautan budget dan kalender. Sel tanggal kalender (40px) tidak diubah karena saling berdempet. |
| #6 | Diperbaiki | Logo sidebar putih, cincin hitung mundur putih transparan, teks mahar memakai `text-accent`. |
| #9 | Diperbaiki | Label tombol urutan capsule menjadi "Naikkan" dan "Turunkan". |
| #10 | Diperbaiki | Isian memakai border `outline #c9c8d6`. |
| #5, #7, #8, #11 sampai #15 | Belum | Butuh keputusan konten (syarat dan ketentuan, susunan landing, CTA) atau di luar lingkup. |

## Delivery Gate (fitur Moodboard)

Block 1, Hard Gate
- R-02 PASS: tidak ada em dash di teks baru.
- R-03 PASS: 1280px, 820px, 390px dicek; overflow horizontal 0; tombol baru minimal 40px dengan area sentuh 44px.
- R-17, R-18, R-36, R-38 PASS: tidak ada angka, nama, atau contoh fiktif; papan mulai kosong.
- R-23 PASS: tidak ada aset baru selain ikon lucide.
- R-24 PASS: menu Moodboard menuju halaman yang ada.
- R-25 PASS: teks baru memakai ink, muted (5,7:1+), atau note-fg.
- R-26 PASS: semua tombol diklik saat uji (lihat di bawah).
- R-27 PASS: empty state dengan aksi, status simpan (Tersimpan, Menyimpan, Gagal dengan Coba lagi, Bentrok dengan Muat ulang), kartu "Mengunggah…", pesan gagal unggah.
- R-32 PASS: kanvas fokus dengan outline, panah/Delete/Esc/V/C, panel detail bisa dipakai penuh dengan Tab.
- R-35 PASS: dijalankan di `next dev` dan Chrome headless, console bersih.

Uji klik (1280px kecuali disebut):
- Buat kelompok awal: tiga kelompok dibuat dan tampilan dipaskan.
- Catatan: kartu dibuat, judul dan isi tersimpan.
- Tag baru "Siraman": tersimpan dan tetap ada setelah muat ulang.
- Warna: palet dibuat.
- Foto (input file): unggah ke `/api/upload`, tampil dari `/api/files/[id]`.
- Muat ulang: kartu, kelompok, dan sambungan tetap ada.
- Panah kanan dua kali: kartu bergeser 20px.
- Sambung lewat panel, lalu label "warna ikut ini": satu sambungan dengan label.
- Tarik kartu foto dan tarik kanvas: posisi berubah, status Tersimpan.
- Delete pada kartu terpilih: jumlah kartu 5 menjadi 4.
- Tab Akad: empty state muncul.
- 820px: kanvas tampil dan dipaskan, Moodboard ada di Lainnya.
- 390px: penjelasan tampil, Moodboard tidak ada di Lainnya maupun editor capsule.

Belum diuji: bentrok simpan antar dua anggota (butuh dua sesi bersamaan), cubit dua jari (butuh layar sentuh), drag-and-drop file dari desktop.
