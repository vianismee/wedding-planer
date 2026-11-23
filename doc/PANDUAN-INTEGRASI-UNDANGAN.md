# Panduan integrasi undangan digital

Panduan ini menghubungkan undangan digital yang di-host di tempat lain (situs sendiri, Netlify, Vercel, hosting PHP, dan sebagainya) dengan daftar tamu di Rukun. Setelah terhubung:

- Setiap tamu punya link pribadi, misalnya `https://undangan.contoh.com/rina-dimas?to=wtr3agxf`.
- Halaman undangan menyapa tamu dengan namanya ("Kepada Yth. Bpk. Sutrisno dan Ibu").
- Rukun mencatat kapan undangan dibuka.
- RSVP dan ucapan dari undangan langsung masuk ke Daftar tamu di Rukun.
- Halaman undangan bisa menampilkan rangkaian acara dan kumpulan ucapan dari Rukun.

Detail setiap endpoint ada di [Referensi API](API.md).

## Daftar isi

1. [Gambaran alur](#1-gambaran-alur)
2. [Buat kunci API](#2-buat-kunci-api)
3. [Isi pola link undangan](#3-isi-pola-link-undangan)
4. [Bagikan link pribadi ke tamu](#4-bagikan-link-pribadi-ke-tamu)
5. [Sambungkan halaman undangan (HTML + JavaScript)](#5-sambungkan-halaman-undangan-html--javascript)
6. [Sinkronisasi tamu dari backend (kunci server)](#6-sinkronisasi-tamu-dari-backend-kunci-server)
7. [Keamanan](#7-keamanan)
8. [Uji coba dan pemecahan masalah](#8-uji-coba-dan-pemecahan-masalah)

## 1. Gambaran alur

```
Rukun (daftar tamu)                          Undangan digital (situs lain)
───────────────────                          ─────────────────────────────
Tamu "Bpk. Sutrisno", kode wtr3agxf
        │
        │ link pribadi dikirim lewat WhatsApp/Instagram
        ▼
https://undangan.contoh.com/rina-dimas?to=wtr3agxf  ──►  halaman membaca ?to=wtr3agxf
                                                          │
        GET  /api/v1/invitations/wtr3agxf  ◄──────────────┤  nama tamu, jatah orang
        POST /api/v1/invitations/wtr3agxf/open  ◄─────────┤  catat undangan dibuka
        GET  /api/v1/wedding  ◄───────────────────────────┤  acara, tanggal, lokasi
        POST /api/v1/invitations/wtr3agxf/rsvp  ◄─────────┤  form RSVP + ucapan
        GET  /api/v1/wishes  ◄────────────────────────────┘  daftar ucapan
        │
        ▼
RSVP muncul di Daftar tamu Rukun
```

## 2. Buat kunci API

1. Masuk ke Rukun sebagai pemilik, atau anggota dengan izin *Ubah* untuk Pengaturan dan Tamu.
2. Buka **Pengaturan → API undangan**.
3. Di bagian **Kunci API**, isi:
   - **Nama kunci:** misalnya `Undangan web`.
   - **Jenis:** pilih **Undangan (boleh di browser)**.
   - **Domain undangan:** domain tempat undangan di-host, misalnya `https://undangan.contoh.com`. Kalau undangan bisa dibuka dari lebih dari satu domain (misalnya `www` dan tanpa `www`), tulis satu domain per baris.
4. Klik **Buat kunci**, lalu **salin kuncinya sekarang**. Kunci diawali `rkn_pk_` dan tidak akan ditampilkan lagi.

Buat juga kunci **Server** (`rkn_sk_…`) hanya bila kamu punya backend yang perlu membaca atau mengubah daftar tamu lengkap (lihat [bagian 6](#6-sinkronisasi-tamu-dari-backend-kunci-server)). Untuk undangan biasa, kunci undangan sudah cukup.

## 3. Isi pola link undangan

Masih di **Pengaturan → API undangan**, isi **Pola link** dengan alamat undangan dan tulis `{kode}` di tempat kode tamu:

| Pola link | Link untuk tamu berkode `wtr3agxf` |
| --- | --- |
| `https://undangan.contoh.com/rina-dimas?to={kode}` | `https://undangan.contoh.com/rina-dimas?to=wtr3agxf` |
| `https://undangan.contoh.com/u/{kode}` | `https://undangan.contoh.com/u/wtr3agxf` |
| `https://undangan.contoh.com/rina-dimas` (tanpa `{kode}`) | `https://undangan.contoh.com/rina-dimas?to=wtr3agxf` |

Pola ini hanya dipakai Rukun untuk membuat link. Pastikan halaman undanganmu membaca kode dari bagian URL yang sama.

## 4. Bagikan link pribadi ke tamu

Setelah pola link diisi, ada tiga cara mengambil link pribadi setiap tamu:

- **Daftar tamu:** di bawah nama setiap tamu ada tombol **Salin link undangan**. Kalau nomor WhatsApp atau username Instagram tamu sudah diisi, klik nomor atau username itu untuk membuka chat atau profilnya, lalu tempel link-nya.
- **Ekspor CSV:** kolom **Kode** dan **Link undangan** ada di file ekspor, cocok untuk kirim massal.
- **API:** `GET /api/v1/guests` dengan kunci server mengembalikan `invitationUrl` untuk setiap tamu.

Setelah dikirim, tandai tamu sebagai **Terkirim** di Daftar tamu, atau lewat API dengan `PATCH /guests/{id}` `{"status":"terkirim"}`.

## 5. Sambungkan halaman undangan (HTML + JavaScript)

Contoh berikut tidak butuh framework atau backend, jadi bisa ditempel ke undangan HTML statis. Ganti `API_KEY` dengan kunci undangan dari langkah 2.

```html
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Undangan Pernikahan</title>
</head>
<body>
  <p id="sapaan">Kepada Yth. Bapak/Ibu/Saudara/i</p>
  <h1 id="pasangan"></h1>
  <ul id="acara"></ul>

  <form id="rsvp" hidden>
    <fieldset>
      <legend>Konfirmasi kehadiran</legend>
      <label><input type="radio" name="attendance" value="hadir" required /> Hadir</label>
      <label><input type="radio" name="attendance" value="tidak_hadir" /> Tidak hadir</label>
      <label><input type="radio" name="attendance" value="ragu" /> Masih ragu</label>
    </fieldset>
    <label>Jumlah yang hadir <input type="number" name="pax" min="1" value="1" /></label>
    <label>Ucapan dan doa <textarea name="message" maxlength="500"></textarea></label>
    <button type="submit">Kirim</button>
    <p id="rsvp-status" role="status"></p>
  </form>

  <section>
    <h2>Ucapan</h2>
    <ul id="ucapan"></ul>
  </section>

  <script>
    const API = "https://nikah.vianismee.my.id/api/v1";
    const API_KEY = "rkn_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // kunci UNDANGAN, bukan kunci server

    // Kode tamu dari ?to=…  Untuk pola /u/{kode}, ambil dari location.pathname.
    const code = new URLSearchParams(location.search).get("to");

    async function api(path, options = {}) {
      const res = await fetch(API + path, {
        ...options,
        headers: { Authorization: "Bearer " + API_KEY, "Content-Type": "application/json", ...options.headers },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error?.message ?? "Gagal terhubung ke server.");
      return json;
    }

    const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

    async function loadWedding() {
      const { data: w } = await api("/wedding");
      document.getElementById("pasangan").textContent = `${w.brideName} & ${w.groomName}`;
      const list = document.getElementById("acara");
      for (const e of w.events) {
        const tanggal = e.date
          ? new Date(e.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : "Tanggal menyusul";
        list.append(el("li", `${e.name}: ${tanggal}${e.startTime ? ", pukul " + e.startTime : ""}${e.location ? ", " + e.location : ""}`));
      }
    }

    async function loadGuest() {
      if (!code) return; // dibuka tanpa link pribadi: tampilkan undangan umum
      try {
        const { data: g } = await api(`/invitations/${encodeURIComponent(code)}`);
        document.getElementById("sapaan").textContent = `Kepada Yth. ${g.name}`;
        api(`/invitations/${encodeURIComponent(code)}/open`, { method: "POST" }).catch(() => {});

        const form = document.getElementById("rsvp");
        form.hidden = false;
        form.pax.max = g.pax;
        form.pax.value = g.rsvp.pax || g.pax;
        if (g.rsvp.status) form.querySelector(`[value="${g.rsvp.status}"]`).checked = true;
        if (g.rsvp.message) form.message.value = g.rsvp.message;
      } catch {
        // Kode salah atau tamu sudah dihapus: tetap tampilkan undangan umum.
      }
    }

    async function loadWishes() {
      const { data } = await api("/wishes?limit=50");
      const list = document.getElementById("ucapan");
      list.replaceChildren(...data.map((w) => el("li", `${w.name}: ${w.message}`)));
    }

    document.getElementById("rsvp").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = document.getElementById("rsvp-status");
      const attendance = form.attendance.value;
      const body = { attendance, message: form.message.value.trim() || null };
      if (attendance !== "tidak_hadir") body.pax = Number(form.pax.value);
      status.textContent = "Mengirim…";
      try {
        await api(`/invitations/${encodeURIComponent(code)}/rsvp`, { method: "POST", body: JSON.stringify(body) });
        status.textContent = "Terima kasih, konfirmasimu sudah kami terima.";
        loadWishes();
      } catch (err) {
        status.textContent = err.message;
      }
    });

    loadWedding();
    loadGuest();
    loadWishes();
  </script>
</body>
</html>
```

Catatan untuk contoh di atas:

- Teks dari API dipasang dengan `textContent`, bukan `innerHTML`. Ucapan ditulis oleh tamu, jadi jangan pernah memasangnya sebagai HTML.
- Kalau undangan dibuka tanpa `?to=` atau dengan kode yang salah, halaman tetap tampil sebagai undangan umum tanpa form RSVP.
- Tamu boleh mengirim ulang RSVP, dan jawaban terakhir yang dipakai. Form di atas sudah terisi jawaban sebelumnya.
- `pax` tidak boleh melebihi jatah undangan. Kalau lebih, API menjawab `pax_exceeded` dan pesannya tampil di form.

### Contoh untuk framework

Endpoint dan kuncinya sama, hanya cara memanggilnya yang berbeda. Contoh di React atau Next.js (komponen klien):

```tsx
"use client";
import { useEffect, useState } from "react";

const API = "https://nikah.vianismee.my.id/api/v1";
const KEY = process.env.NEXT_PUBLIC_RUKUN_INVITATION_KEY!; // kunci undangan rkn_pk_…

type Invitation = { code: string; name: string; pax: number; rsvp: { status: string | null; pax: number | null; message: string | null } };

export function Sapaan({ code }: { code: string | null }) {
  const [guest, setGuest] = useState<Invitation | null>(null);
  useEffect(() => {
    if (!code) return;
    fetch(`${API}/invitations/${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${KEY}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setGuest(j.data));
    fetch(`${API}/invitations/${encodeURIComponent(code)}/open`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` } }).catch(() => {});
  }, [code]);
  return <p>Kepada Yth. {guest?.name ?? "Bapak/Ibu/Saudara/i"}</p>;
}
```

## 6. Sinkronisasi tamu dari backend (kunci server)

Pakai kunci server bila kamu perlu:

- membaca daftar tamu lengkap beserta nomor WA, Instagram, dan alamat (misalnya untuk kirim WhatsApp massal),
- menambah, mengubah, atau menghapus tamu dari sistem lain,
- menarik rekap RSVP ke spreadsheet atau dasbor sendiri.

Kunci server **hanya boleh disimpan di backend**, misalnya di environment variable server. Rukun menolak kunci server yang dipanggil dari browser.

### Node.js (18 atau lebih baru)

```js
// sync-tamu.mjs  Jalankan: RUKUN_SERVER_KEY=rkn_sk_… node sync-tamu.mjs
const API = "https://nikah.vianismee.my.id/api/v1";
const headers = { Authorization: `Bearer ${process.env.RUKUN_SERVER_KEY}`, "Content-Type": "application/json" };

async function api(path, options = {}) {
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(`${json.error.code}: ${json.error.message}`);
  return json;
}

// Ambil semua tamu, halaman demi halaman.
async function semuaTamu(query = "") {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await api(`/guests?limit=500&page=${page}${query}`);
    out.push(...data);
    if (page >= meta.pages) return out;
  }
}

// Tambah tamu baru.
const { data: baru } = await api("/guests", {
  method: "POST",
  body: JSON.stringify({ name: "Ibu Wulan", side: "wanita", pax: 2, phone: "0813 2222 3333", delivery: "whatsapp" }),
});
console.log("Link undangan:", baru.invitationUrl);

// Rekap yang sudah RSVP hadir.
const hadir = await semuaTamu("&rsvp=hadir");
console.log("Hadir:", hadir.length, "undangan,", hadir.reduce((s, g) => s + g.rsvp.pax, 0), "orang");

// Tandai terkirim setelah link dikirim.
await api(`/guests/${baru.code}`, { method: "PATCH", body: JSON.stringify({ status: "terkirim" }) });
```

### PHP

```php
<?php
// Simpan kunci di environment server, jangan di file yang bisa diunduh publik.
$api = 'https://nikah.vianismee.my.id/api/v1';
$key = getenv('RUKUN_SERVER_KEY');

function rukun(string $method, string $path, ?array $body = null) {
    global $api, $key;
    $ch = curl_init($api . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $key", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => $body === null ? null : json_encode($body),
    ]);
    $res = json_decode(curl_exec($ch), true);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status >= 400) throw new Exception($res['error']['message'] ?? "HTTP $status");
    return $res;
}

$tamu = rukun('GET', '/guests?rsvp=hadir&limit=500');
foreach ($tamu['data'] as $g) {
    echo $g['name'] . ' - ' . $g['rsvp']['pax'] . " orang\n";
}
```

### Proxy untuk menyembunyikan kunci (opsional)

Kunci undangan memang dirancang untuk terlihat di browser. Kalau tetap tidak ingin kunci itu tampil, buat endpoint kecil di backend undanganmu yang meneruskan request ke Rukun. Contohnya di Next.js (`app/api/rsvp/[code]/route.ts`):

```ts
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = await fetch(`https://nikah.vianismee.my.id/api/v1/invitations/${encodeURIComponent(code)}/rsvp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RUKUN_INVITATION_KEY}`, "Content-Type": "application/json" },
    body: await req.text(),
  });
  return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/json" } });
}
```

Karena dipanggil dari server (tanpa header `Origin`), proxy ini tidak terkena pemeriksaan domain. Kunci undangan tetap tidak bisa membaca daftar tamu lengkap.

## 7. Keamanan

- **Kunci undangan** (`rkn_pk_…`) aman ditaruh di kode halaman. Kunci ini hanya bisa membaca info acara, ucapan, dan data satu tamu yang kodenya diketahui. Nomor HP, Instagram, alamat, dan catatan internal tidak pernah dikirim.
- **Kunci server** (`rkn_sk_…`) membuka seluruh daftar tamu beserta kontaknya. Simpan hanya di backend, jangan di repo publik, dan jangan dibagikan lewat chat.
- **Daftarkan domain** pada kunci undangan, supaya situs lain tidak bisa memakai kuncimu dari browser pengunjungnya.
- **Kode tamu** terdiri dari 8 karakter acak, dan percobaan menebak dibatasi 120 permintaan per menit per IP. Meski begitu, anggap link pribadi sebagai rahasia kecil: kirim langsung ke tamu yang bersangkutan, jangan disebar di grup.
- **Ucapan ditampilkan apa adanya.** Selalu pasang sebagai teks (`textContent`) supaya tidak bisa menyisipkan script.
- **Kunci bocor?** Hapus di Pengaturan → API undangan, buat kunci baru, lalu ganti kunci di undangan. Kunci lama langsung berhenti bekerja.
- Kolom **Terakhir dipakai** di daftar kunci membantu mengenali kunci yang tidak dipakai lagi. Hapus kunci yang tidak terpakai.

## 8. Uji coba dan pemecahan masalah

Cek kunci dari terminal:

```bash
curl -i https://nikah.vianismee.my.id/api/v1/wedding -H "Authorization: Bearer rkn_pk_…"
```

Respons `200` dengan nama pasangan berarti kunci sudah benar. Untuk mencoba RSVP tanpa mengganggu data tamu asli, tambahkan satu tamu uji di Daftar tamu, coba link-nya, lalu hapus tamu itu.

| Gejala | Penyebab dan solusi |
| --- | --- |
| `401 unauthorized` | Kunci salah ketik, terpotong saat disalin, atau sudah dihapus. Buat kunci baru |
| `403 origin_not_allowed` | Domain undangan belum didaftarkan di kunci, atau berbeda sedikit (`www`, `http` vs `https`, port). Pesan galat menyebut origin yang dipakai browser. Buat kunci baru dengan domain itu |
| `403 server_key_in_browser` | Kunci server dipakai di JavaScript halaman. Ganti dengan kunci undangan |
| `403 forbidden` | Kunci undangan dipakai untuk `/guests`. Endpoint itu butuh kunci server dari backend |
| `404 not_found` di `/invitations/{code}` | Kode di link salah atau tamunya sudah dihapus. Salin ulang link dari Daftar tamu |
| `422 pax_exceeded` | Jumlah yang hadir melebihi jatah undangan. Batasi input `pax` dengan `max` sesuai `pax` dari API |
| `429 rate_limited` | Terlalu banyak request dalam satu menit. Jangan memanggil API berulang dalam loop atau setiap detik |
| Error CORS di console browser, tanpa respons | Pastikan URL API benar (`/api/v1/…`) dan memakai `https://` |
| Link undangan tidak muncul di Daftar tamu | Pola link belum diisi di Pengaturan → API undangan |
