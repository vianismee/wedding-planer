# Rukun REST API v1

Referensi API untuk menghubungkan Rukun dengan undangan digital atau aplikasi lain di luar Rukun. Langkah integrasi dari nol ada di [Panduan integrasi undangan](PANDUAN-INTEGRASI-UNDANGAN.md).

- **Base URL:** `https://nikah.vianismee.my.id/api/v1` (atau `<BETTER_AUTH_URL>/api/v1` untuk instalasi lain)
- **Format:** JSON, UTF-8. Kirim `Content-Type: application/json` untuk request yang membawa body.
- **Waktu:** ISO 8601 UTC, misalnya `2026-11-23T15:52:06.720Z`. Tanggal acara memakai `YYYY-MM-DD` dan jam `HH:MM` waktu setempat.

## Daftar isi

1. [Autentikasi](#autentikasi)
2. [Jenis kunci dan hak akses](#jenis-kunci-dan-hak-akses)
3. [Format respons dan galat](#format-respons-dan-galat)
4. [Batas permintaan](#batas-permintaan)
5. [CORS (memanggil dari browser)](#cors-memanggil-dari-browser)
6. [Objek data](#objek-data)
7. [Endpoint](#endpoint)
   - [GET /wedding](#get-wedding)
   - [GET /invitations/{code}](#get-invitationscode)
   - [POST /invitations/{code}/open](#post-invitationscodeopen)
   - [POST /invitations/{code}/rsvp](#post-invitationscodersvp)
   - [GET /wishes](#get-wishes)
   - [GET /guests](#get-guests)
   - [POST /guests](#post-guests)
   - [GET /guests/{id}](#get-guestsid)
   - [PATCH /guests/{id}](#patch-guestsid)
   - [DELETE /guests/{id}](#delete-guestsid)
8. [Nilai enum](#nilai-enum)

## Autentikasi

Setiap request wajib membawa kunci API. Kunci dibuat di **Pengaturan → API undangan** oleh anggota yang punya izin *Ubah* untuk Pengaturan dan Tamu. Satu kunci terikat pada satu ruang pernikahan, jadi tidak perlu mengirim id pernikahan.

Kirim kunci lewat salah satu header berikut:

```http
Authorization: Bearer rkn_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```http
X-Api-Key: rkn_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Kunci utuh hanya tampil sekali saat dibuat, dan Rukun hanya menyimpan hash-nya. Kalau kunci hilang atau bocor, hapus kunci itu di Pengaturan lalu buat yang baru. Kunci yang dihapus langsung berhenti bekerja.

## Jenis kunci dan hak akses

| | Kunci undangan `rkn_pk_…` | Kunci server `rkn_sk_…` |
| --- | --- | --- |
| Tujuan | JavaScript di halaman undangan (publik) | Backend, skrip sinkronisasi, integrasi lain |
| Boleh dipakai di browser | Ya, dibatasi domain yang didaftarkan | **Tidak.** Ditolak bila request membawa header `Origin` |
| `GET /wedding` | Ya | Ya |
| `GET /invitations/{code}` | Ya | Ya |
| `POST /invitations/{code}/open` | Ya | Ya |
| `POST /invitations/{code}/rsvp` | Ya | Ya |
| `GET /wishes` | Ya | Ya |
| `/guests` (daftar, tambah, ubah, hapus) | Tidak | Ya |
| Nomor WA, Instagram, alamat, catatan tamu | Tidak pernah dikirim | Ya |

Kunci undangan hanya bisa membuka data satu tamu bila kode undangannya diketahui. Kode itu 8 karakter acak yang ada di link pribadi tiap tamu.

## Format respons dan galat

Respons berhasil selalu dibungkus `data`. Endpoint daftar menambahkan `meta` untuk halaman:

```json
{
  "data": [ … ],
  "meta": { "page": 1, "limit": 100, "total": 240, "pages": 3 }
}
```

`DELETE` yang berhasil menjawab `204 No Content` tanpa body.

Galat selalu berbentuk:

```json
{ "error": { "code": "validation_error", "message": "phone: nomor WhatsApp tidak valid" } }
```

`message` berbahasa Indonesia dan aman ditampilkan ke pengguna. Untuk logika program, pakai `code`.

| HTTP | `code` | Arti |
| --- | --- | --- |
| 400 | `invalid_json` | Body bukan JSON yang valid |
| 401 | `unauthorized` | Kunci tidak dikirim, salah, atau sudah dihapus |
| 403 | `forbidden` | Kunci undangan memanggil endpoint khusus kunci server |
| 403 | `server_key_in_browser` | Kunci server dipakai dari browser (ada header `Origin`) |
| 403 | `origin_not_allowed` | Domain halaman tidak terdaftar untuk kunci undangan ini |
| 404 | `not_found` | Tamu atau undangan tidak ditemukan |
| 422 | `validation_error` | Isian tidak valid atau ada kolom yang tidak dikenal |
| 422 | `pax_exceeded` | Jumlah yang hadir melebihi jatah undangan |
| 429 | `rate_limited` | Terlalu banyak permintaan, tunggu satu menit |
| 500 | `server_error` | Kesalahan di server Rukun |

## Batas permintaan

| Kunci | Batas |
| --- | --- |
| Server | 300 permintaan per menit per kunci |
| Undangan | 120 permintaan per menit per kunci per alamat IP pengunjung |

Bila melewati batas, API menjawab `429`. Tunggu sampai menit berikutnya lalu coba lagi.

## CORS (memanggil dari browser)

- Preflight `OPTIONS` dijawab otomatis untuk semua endpoint.
- Saat membuat kunci undangan, daftarkan domain halaman undangan, misalnya `https://undangan.contoh.com`. Tulis lengkap dengan `https://`, tanpa path, dan tanpa garis miring di akhir. Request dari domain lain ditolak dengan `origin_not_allowed`.
- Kosongkan daftar domain hanya untuk uji coba, karena kunci itu jadi bisa dipakai dari domain mana pun.
- Pemeriksaan domain hanya berlaku di browser. Program di luar browser tetap bisa memakai kunci undangan, tapi hanya untuk endpoint di kolom kiri tabel hak akses di atas.

## Objek data

### Guest (kunci server)

```json
{
  "id": "632a3f52-cb4d-47e3-af0d-f867d8506fd8",
  "code": "wtr3agxf",
  "name": "Bpk. Sutrisno dan Ibu",
  "note": "Pakde, Mojokerto",
  "phone": "6281234567890",
  "instagram": "sutris.no",
  "address": "Jl. Melati 5, Solo",
  "category": "Keluarga",
  "side": "pria",
  "session": "Sesi 1",
  "pax": 3,
  "delivery": "whatsapp",
  "status": "belum_kirim",
  "vip": false,
  "invitationUrl": "https://undangan.contoh.com/rina-dimas?to=wtr3agxf",
  "openedAt": "2026-11-23T15:52:04.821Z",
  "rsvp": {
    "status": "hadir",
    "pax": 2,
    "message": "Selamat menempuh hidup baru!",
    "at": "2026-11-23T15:52:06.720Z"
  },
  "createdAt": "2026-11-23T15:51:58.649Z"
}
```

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | string | Id tetap tamu |
| `code` | string | Kode undangan, 8 karakter `a-z` dan `2-9`. Unik per pernikahan |
| `name` | string | Nama di undangan, maksimal 120 karakter |
| `note` | string \| null | Keterangan internal, misalnya hubungan atau kota. Maksimal 160 karakter |
| `phone` | string \| null | Nomor WhatsApp dalam format internasional tanpa `+`, misalnya `6281234567890` |
| `instagram` | string \| null | Username Instagram tanpa `@` |
| `address` | string \| null | Alamat, opsional, maksimal 300 karakter |
| `category` | string | Kelompok tamu, misalnya Keluarga, Teman kantor. Maksimal 40 karakter |
| `side` | `pria` \| `wanita` | Tamu dari pihak mana |
| `session` | string | Sesi resepsi, misalnya `Sesi 1`. Maksimal 40 karakter |
| `pax` | integer | Jatah orang untuk undangan ini, 1 sampai 500 |
| `delivery` | enum | Cara kirim undangan, lihat [nilai enum](#nilai-enum) |
| `status` | enum | Status pengiriman undangan |
| `vip` | boolean | Tamu VIP |
| `invitationUrl` | string \| null | Link pribadi tamu. Null bila pola link belum diisi di Pengaturan |
| `openedAt` | string \| null | Kapan undangan pertama kali dibuka |
| `rsvp` | object | Jawaban RSVP. Semua kolomnya null bila tamu belum menjawab |
| `createdAt` | string | Kapan tamu ditambahkan |

### Invitation (semua kunci)

Data tamu versi publik, tanpa kontak, alamat, dan catatan internal.

```json
{
  "code": "wtr3agxf",
  "name": "Bpk. Sutrisno dan Ibu",
  "side": "pria",
  "session": "Sesi 1",
  "pax": 3,
  "vip": false,
  "rsvp": { "status": null, "pax": null, "message": null, "at": null }
}
```

### Wedding

```json
{
  "groomName": "Dimas",
  "brideName": "Rina",
  "akadDate": "2027-04-13",
  "city": "Surakarta",
  "accent": "#D6F06B",
  "events": [
    {
      "id": "fe6074bb-5439-4b4b-9415-83291a8705ff",
      "name": "Akad nikah",
      "kind": "akad",
      "date": "2027-04-13",
      "startTime": "08:00",
      "location": "Masjid Agung Surakarta"
    }
  ]
}
```

### Wish

```json
{ "name": "Bpk. Sutrisno dan Ibu", "message": "Selamat menempuh hidup baru!", "attendance": "hadir", "at": "2026-11-23T15:52:06.720Z" }
```

## Endpoint

### GET /wedding

Info pasangan dan rangkaian acara untuk ditampilkan di undangan. Bisa dipakai dengan **semua kunci**.

```bash
curl https://nikah.vianismee.my.id/api/v1/wedding \
  -H "Authorization: Bearer rkn_pk_…"
```

Respons `200` berisi objek [Wedding](#wedding). Acara diurutkan sesuai urutan di halaman Acara.

### GET /invitations/{code}

Data satu tamu berdasarkan kode di link undangannya, misalnya untuk sapaan "Kepada Yth. …". Bisa dipakai dengan **semua kunci**.

```bash
curl https://nikah.vianismee.my.id/api/v1/invitations/wtr3agxf \
  -H "Authorization: Bearer rkn_pk_…"
```

Respons `200` berisi objek [Invitation](#invitation-semua-kunci). Bila kode tidak dikenal, responsnya `404 not_found`. Kode tidak membedakan huruf besar dan kecil.

### POST /invitations/{code}/open

Mencatat bahwa tamu sudah membuka undangannya. Hanya pembukaan pertama yang disimpan, jadi aman dipanggil setiap kali halaman dimuat. Tanpa body.

```bash
curl -X POST https://nikah.vianismee.my.id/api/v1/invitations/wtr3agxf/open \
  -H "Authorization: Bearer rkn_pk_…"
```

```json
{ "data": { "openedAt": "2026-11-23T15:52:04.821Z", "first": true } }
```

`first` bernilai `false` bila undangan sudah pernah dibuka sebelumnya.

### POST /invitations/{code}/rsvp

Mengirim atau mengubah RSVP. Tamu boleh mengirim ulang, dan jawaban terakhir yang dipakai.

| Kolom body | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `attendance` | `hadir` \| `tidak_hadir` \| `ragu` | Ya | Jawaban kehadiran |
| `pax` | integer | Tidak | Jumlah yang hadir. Bawaan: jatah undangan. Maksimal sama dengan `pax` undangan. Untuk `tidak_hadir` selalu disimpan 0 |
| `message` | string \| null | Tidak | Ucapan dan doa, maksimal 500 karakter. Bila tidak dikirim, ucapan sebelumnya dipertahankan. Kirim `null` untuk menghapusnya |

```bash
curl -X POST https://nikah.vianismee.my.id/api/v1/invitations/wtr3agxf/rsvp \
  -H "Authorization: Bearer rkn_pk_…" \
  -H "Content-Type: application/json" \
  -d '{"attendance":"hadir","pax":2,"message":"Selamat menempuh hidup baru!"}'
```

Respons `200` berisi objek [Invitation](#invitation-semua-kunci) yang sudah diperbarui. Bila `pax` melebihi jatah, responsnya `422 pax_exceeded`.

RSVP langsung terlihat di halaman Daftar tamu Rukun, dan anggota yang sedang membuka halaman itu melihatnya tanpa perlu memuat ulang.

### GET /wishes

Ucapan dari RSVP, yang terbaru lebih dulu. Bisa dipakai dengan **semua kunci**.

| Query | Bawaan | Keterangan |
| --- | --- | --- |
| `page` | 1 | Nomor halaman |
| `limit` | 20 | Jumlah per halaman, maksimal 100 |

```bash
curl "https://nikah.vianismee.my.id/api/v1/wishes?limit=10" \
  -H "Authorization: Bearer rkn_pk_…"
```

Respons `200` berisi daftar [Wish](#wish) dan `meta`.

### GET /guests

Daftar tamu lengkap. **Hanya kunci server.**

| Query | Keterangan |
| --- | --- |
| `q` | Cari di nama, keterangan, nomor WA, Instagram, dan kode |
| `side` | `pria` atau `wanita` |
| `category` | Nama kategori, persis sama |
| `session` | Nama sesi, persis sama |
| `status` | `belum_kirim`, `terkirim`, atau `cek_jumlah` |
| `rsvp` | `hadir`, `tidak_hadir`, atau `ragu` |
| `page` | Nomor halaman, bawaan 1 |
| `limit` | Jumlah per halaman, bawaan 100, maksimal 500 |

Hasil diurutkan berdasarkan nama.

```bash
curl "https://nikah.vianismee.my.id/api/v1/guests?side=pria&rsvp=hadir&limit=200" \
  -H "Authorization: Bearer rkn_sk_…"
```

Respons `200` berisi daftar [Guest](#guest-kunci-server) dan `meta`.

### POST /guests

Menambah satu tamu. **Hanya kunci server.**

| Kolom | Wajib | Bawaan |
| --- | --- | --- |
| `name` | Ya | |
| `side` | Ya | |
| `note`, `phone`, `instagram`, `address` | Tidak | `null` |
| `category` | Tidak | `Lainnya` |
| `session` | Tidak | `Sesi 1` |
| `pax` | Tidak | `2` |
| `delivery` | Tidak | `diantar` |
| `status` | Tidak | `belum_kirim` |
| `vip` | Tidak | `false` |

`phone` boleh ditulis `0812…`, `+62 812…`, `62812…`, atau `812…`. Semuanya disimpan sebagai `62812…`. `instagram` boleh berupa `@username`, `username`, atau tautan profil. Kolom yang tidak dikenal ditolak dengan `validation_error`, supaya salah ketik nama kolom langsung ketahuan.

```bash
curl -X POST https://nikah.vianismee.my.id/api/v1/guests \
  -H "Authorization: Bearer rkn_sk_…" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bpk. Sutrisno dan Ibu",
    "side": "pria",
    "pax": 3,
    "category": "Keluarga",
    "phone": "0812-3456-7890",
    "delivery": "whatsapp",
    "address": "Jl. Melati 5, Solo"
  }'
```

Respons `201` berisi [Guest](#guest-kunci-server) baru, termasuk `code` dan `invitationUrl`-nya.

### GET /guests/{id}

Satu tamu. `{id}` boleh berupa `id` atau `code` tamu. **Hanya kunci server.**

```bash
curl https://nikah.vianismee.my.id/api/v1/guests/wtr3agxf \
  -H "Authorization: Bearer rkn_sk_…"
```

### PATCH /guests/{id}

Mengubah sebagian kolom. Kolom yang sama dengan `POST /guests` boleh dikirim, dan semuanya opsional. Kolom yang tidak dikirim tidak berubah. Kirim `null` untuk mengosongkan `note`, `phone`, `instagram`, atau `address`. **Hanya kunci server.**

```bash
curl -X PATCH https://nikah.vianismee.my.id/api/v1/guests/wtr3agxf \
  -H "Authorization: Bearer rkn_sk_…" \
  -H "Content-Type: application/json" \
  -d '{"status":"terkirim","vip":true}'
```

Respons `200` berisi [Guest](#guest-kunci-server) yang sudah diperbarui. RSVP dan `openedAt` tidak bisa diubah lewat endpoint ini, karena keduanya hanya diisi lewat endpoint undangan.

### DELETE /guests/{id}

Menghapus tamu secara permanen. **Hanya kunci server.**

```bash
curl -X DELETE https://nikah.vianismee.my.id/api/v1/guests/wtr3agxf \
  -H "Authorization: Bearer rkn_sk_…"
```

Respons `204` tanpa body.

## Nilai enum

| Kolom | Nilai |
| --- | --- |
| `side` | `pria`, `wanita` |
| `delivery` | `diantar`, `whatsapp`, `instagram`, `email`, `pos` |
| `status` | `belum_kirim` (Belum dikirim), `terkirim` (Terkirim), `cek_jumlah` (Cek jumlah orang) |
| `rsvp.status`, `attendance` | `hadir`, `tidak_hadir`, `ragu` |
| `events[].kind` | `akad`, `resepsi`, `lamaran`, `adat`, `pengajian`, `lainnya` |
