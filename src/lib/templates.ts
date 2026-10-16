// Isi bawaan template adat. Semua item bisa diedit pengguna setelah onboarding.
// Konten ini perlu direview perias atau sesepuh sebelum beta (lihat PRD, pertanyaan terbuka).

export type TemplateId = "jawa" | "sunda" | "nasional" | "kosong";
type AdatId = Exclude<TemplateId, "kosong">;

export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: "jawa", name: "Jawa (Solo/Jogja)", description: "Siraman, midodareni, panggih, sungkeman" },
  { id: "sunda", name: "Sunda", description: "Ngeuyeuk seureuh, siraman, sawer, nincak endog" },
  { id: "nasional", name: "Nasional", description: "Rangkaian ringkas tanpa prosesi adat" },
];

export const templateName = (id: string) => (id === "kosong" ? "Tanpa template" : TEMPLATES.find((t) => t.id === id)?.name ?? id);

export type EventTpl = {
  name: string;
  kind: string;
  offset: number; // hari relatif terhadap akad
  time: string;
  location: string;
  guests: number;
  rundown?: [string, string, string][]; // jam, kegiatan, PIC
};

const LAMARAN: EventTpl = {
  name: "Lamaran",
  kind: "lamaran",
  offset: -120,
  time: "10:00",
  location: "Rumah mempelai wanita",
  guests: 60,
};

const AKAD_ISLAM_RUNDOWN: [string, string, string][] = [
  ["07:00", "Rias dan persiapan mempelai", "MUA"],
  ["07:30", "Kedatangan rombongan mempelai pria", "Among tamu"],
  ["07:45", "Penyerahan seserahan", "Keluarga pria"],
  ["08:00", "Pembukaan dan tilawah", "MC"],
  ["08:15", "Ijab kabul", "Penghulu dan wali nikah"],
  ["08:40", "Tanda tangan buku nikah", "Penghulu"],
  ["09:00", "Sungkeman dan doa", "Keluarga inti"],
  ["09:30", "Foto keluarga", "Dokumentasi"],
];

const PRE_EVENTS: Record<AdatId, EventTpl[]> = {
  jawa: [
    LAMARAN,
    { name: "Pengajian", kind: "pengajian", offset: -1, time: "08:00", location: "Rumah mempelai wanita", guests: 120 },
    {
      name: "Siraman dan midodareni",
      kind: "adat",
      offset: -1,
      time: "14:00",
      location: "Rumah mempelai wanita",
      guests: 80,
      rundown: [
        ["14:00", "Sungkeman sebelum siraman", "Keluarga inti"],
        ["14:30", "Siraman oleh tujuh pinisepuh", "Perias"],
        ["15:30", "Dodol dawet", "Ibu mempelai wanita"],
        ["16:00", "Potong rikmo dan tanam rikmo", "Perias"],
        ["19:00", "Midodareni dan nyantri", "Keluarga wanita"],
        ["20:00", "Catur wedha dan wilujengan", "Ayah mempelai wanita"],
      ],
    },
  ],
  sunda: [
    LAMARAN,
    { name: "Pengajian", kind: "pengajian", offset: -2, time: "08:00", location: "Rumah mempelai wanita", guests: 100 },
    {
      name: "Ngeuyeuk seureuh dan siraman",
      kind: "adat",
      offset: -1,
      time: "14:00",
      location: "Rumah mempelai wanita",
      guests: 60,
      rundown: [
        ["14:00", "Ngecagkeun aisan", "Ibu mempelai wanita"],
        ["14:30", "Siraman", "Perias"],
        ["15:30", "Ngeningan", "Perias"],
        ["19:00", "Ngeuyeuk seureuh", "Pinisepuh"],
      ],
    },
  ],
  nasional: [LAMARAN],
};

const AKAD: Record<AdatId, EventTpl> = {
  jawa: { name: "Akad nikah", kind: "akad", offset: 0, time: "08:00", location: "[Lokasi akad]", guests: 150, rundown: AKAD_ISLAM_RUNDOWN },
  sunda: { name: "Akad nikah", kind: "akad", offset: 0, time: "08:00", location: "[Lokasi akad]", guests: 150, rundown: AKAD_ISLAM_RUNDOWN },
  nasional: { name: "Akad nikah", kind: "akad", offset: 0, time: "08:00", location: "[Lokasi akad]", guests: 100, rundown: AKAD_ISLAM_RUNDOWN },
};

const RESEPSI: Record<AdatId, EventTpl> = {
  jawa: {
    name: "Resepsi",
    kind: "resepsi",
    offset: 1,
    time: "11:00",
    location: "[Gedung resepsi]",
    guests: 800,
    rundown: [
      ["10:00", "Persiapan among tamu dan penerima tamu", "Sinoman"],
      ["11:00", "Kirab pengantin", "Cucuk lampah"],
      ["11:15", "Upacara panggih: balangan gantal, wiji dadi, sindur binayang", "Perias"],
      ["11:45", "Kacar-kucur dan dulangan", "Perias"],
      ["12:00", "Sungkeman", "Keluarga inti"],
      ["12:15", "Ramah tamah dan ucapan selamat", "MC"],
      ["13:30", "Foto bersama", "Dokumentasi"],
    ],
  },
  sunda: {
    name: "Resepsi",
    kind: "resepsi",
    offset: 1,
    time: "11:00",
    location: "[Gedung resepsi]",
    guests: 700,
    rundown: [
      ["11:00", "Mapag panganten", "Keluarga pria"],
      ["11:15", "Sawer panganten", "Juru sawer"],
      ["11:30", "Nincak endog dan buka pintu", "Perias"],
      ["11:45", "Huap lingkung", "Perias"],
      ["12:00", "Ramah tamah dan ucapan selamat", "MC"],
      ["13:30", "Foto bersama", "Dokumentasi"],
    ],
  },
  nasional: {
    name: "Resepsi",
    kind: "resepsi",
    offset: 1,
    time: "11:00",
    location: "[Gedung resepsi]",
    guests: 500,
    rundown: [
      ["10:30", "Persiapan penerima tamu", "Panitia"],
      ["11:00", "Kedatangan pengantin", "MC"],
      ["11:15", "Sambutan keluarga", "Perwakilan keluarga"],
      ["11:30", "Ramah tamah dan ucapan selamat", "MC"],
      ["13:00", "Foto bersama", "Dokumentasi"],
    ],
  },
};

// Template "kosong": ruang pernikahan dimulai tanpa acara, checklist, seserahan, budget, atau dokumen bawaan.
/** Akad dan resepsi dalam satu acara di hari yang sama: sesi akad pagi, jeda ganti busana, lalu resepsi. */
export function combinedEvent(akadTpl: AdatId, resepsiTpl: AdatId): EventTpl {
  const akad = AKAD[akadTpl];
  const resepsi = RESEPSI[resepsiTpl];
  return {
    name: "Akad nikah dan resepsi",
    kind: "akad",
    offset: 0,
    time: akad.time,
    location: "[Lokasi akad dan resepsi]",
    guests: resepsi.guests,
    rundown: [
      ...(akad.rundown ?? []),
      ["09:45", "Jeda, ganti busana dan rias untuk resepsi", "MUA"],
      ...(resepsi.rundown ?? []),
    ],
  };
}

export function buildEvents(akadTpl: TemplateId, resepsiTpl: TemplateId, sameDay = false): EventTpl[] {
  if (akadTpl === "kosong" || resepsiTpl === "kosong") return [];
  const list = [...PRE_EVENTS[akadTpl], ...(sameDay ? [combinedEvent(akadTpl, resepsiTpl)] : [AKAD[akadTpl], RESEPSI[resepsiTpl]])];
  if (akadTpl === "jawa" || resepsiTpl === "jawa") {
    list.push({ name: "Ngunduh mantu", kind: "adat", offset: 14, time: "10:00", location: "Rumah mempelai pria", guests: 300 });
  }
  return list;
}

/* ---------- Katalog untuk "Tambah dari template" di halaman Acara ---------- */

export type AdatTemplateId = AdatId;

/** Semua acara bawaan satu adat (untuk akad dan resepsi adat yang sama), dengan rundown-nya. */
export function templateEvents(tpl: AdatId): EventTpl[] {
  // Akad dan resepsi terpisah, ditambah pilihan gabungan di hari yang sama.
  const list = buildEvents(tpl, tpl);
  const i = list.findIndex((e) => e.kind === "resepsi");
  list.splice(i + 1, 0, combinedEvent(tpl, tpl));
  return list;
}

export type RundownTemplate = { id: string; name: string; adat: string; kind: string; items: [string, string, string][] };

/** Semua template rundown yang tersedia, tanpa duplikat (rundown akad sama untuk ketiga adat). */
export function rundownTemplates(): RundownTemplate[] {
  const out: RundownTemplate[] = [];
  const seen = new Set<string>();
  for (const t of TEMPLATES) {
    for (const e of templateEvents(t.id as AdatId)) {
      if (!e.rundown?.length) continue;
      const sig = JSON.stringify(e.rundown);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const shared = e.kind === "akad" && e.name === "Akad nikah";
      out.push({
        id: `${t.id}:${e.name}`,
        name: shared ? `${e.name} (umum)` : `${e.name}, ${t.name}`,
        adat: shared ? "Semua adat" : t.name,
        kind: e.kind,
        items: e.rundown,
      });
    }
  }
  return out;
}

/* ---------- Seserahan ---------- */

const SESERAHAN_BASE: [string, string][] = [
  ["Perlengkapan ibadah", "Seperangkat alat salat"],
  ["Perlengkapan ibadah", "Al-Qur'an"],
  ["Busana", "Kain dan kebaya"],
  ["Busana", "Gamis"],
  ["Busana", "Set pakaian dalam"],
  ["Busana", "Sepatu dan sandal"],
  ["Kecantikan", "Skincare set"],
  ["Kecantikan", "Make up set"],
  ["Kecantikan", "Parfum"],
  ["Aksesoris dan rumah", "Tas"],
  ["Aksesoris dan rumah", "Jam tangan"],
  ["Aksesoris dan rumah", "Handuk dan perlengkapan mandi"],
];

const SESERAHAN_ADAT: Record<AdatId, [string, string][]> = {
  jawa: [
    ["Makanan tradisional", "Jenang"],
    ["Makanan tradisional", "Wajik"],
    ["Makanan tradisional", "Pisang raja satu tangkep"],
    ["Makanan tradisional", "Buah-buahan"],
    ["Adat", "Suruh ayu (sirih)"],
  ],
  sunda: [
    ["Makanan tradisional", "Dodol"],
    ["Makanan tradisional", "Wajit"],
    ["Makanan tradisional", "Buah-buahan"],
    ["Adat", "Sirih pinang"],
  ],
  nasional: [["Makanan", "Kue dan buah-buahan"]],
};

export function buildSeserahan(akadTpl: TemplateId) {
  if (akadTpl === "kosong") return [];
  return [...SESERAHAN_BASE, ...SESERAHAN_ADAT[akadTpl]];
}

/* ---------- Checklist ---------- */

// [judul, PIC, hari relatif akad]
const TASKS_BASE: [string, string, number][] = [
  ["Tentukan total budget dan sumber dana", "Pasangan", -300],
  ["Susun daftar tamu awal per pihak", "Keluarga", -270],
  ["Survey dan booking gedung resepsi", "Pasangan", -270],
  ["Booking catering dan jadwalkan test food", "Pasangan", -240],
  ["Booking dokumentasi foto dan video", "Pasangan", -210],
  ["Pilih MUA dan jadwal trial rias", "Pengantin wanita", -180],
  ["Pesan busana akad dan resepsi", "Pasangan", -150],
  ["Booking dekorasi", "Pasangan", -150],
  ["Urus surat pengantar RT/RW dan kelurahan", "Pasangan", -90],
  ["Ikut bimbingan perkawinan", "Pasangan", -60],
  ["Cetak dan sebar undangan", "Keluarga", -45],
  ["Beli cincin kawin", "Pasangan", -60],
  ["Lengkapi seserahan", "Keluarga", -30],
  ["Daftar nikah ke KUA atau Dukcapil", "Pasangan", -21],
  ["Final fitting busana", "Pasangan", -14],
  ["Briefing panitia dan among tamu", "Keluarga", -7],
  ["Konfirmasi jumlah porsi ke catering", "Pasangan", -7],
  ["Siapkan amplop untuk vendor dan panitia", "Keluarga", -3],
  ["Gladi bersih", "Panitia", -1],
];

const TASKS_ADAT: Record<AdatId, [string, string, number][]> = {
  jawa: [
    ["Tentukan perias paes dan jadwal siraman", "Keluarga wanita", -120],
    ["Siapkan uborampe siraman dan midodareni", "Keluarga wanita", -14],
    ["Pesan jenang, wajik, dan tumpeng", "Keluarga wanita", -10],
  ],
  sunda: [
    ["Siapkan juru sawer dan perlengkapan sawer", "Keluarga wanita", -30],
    ["Siapkan perlengkapan ngeuyeuk seureuh", "Keluarga wanita", -14],
  ],
  nasional: [],
};

export function buildTasks(akadTpl: TemplateId, resepsiTpl: TemplateId) {
  if (akadTpl === "kosong" || resepsiTpl === "kosong") return [];
  const extra = akadTpl === resepsiTpl ? TASKS_ADAT[akadTpl] : [...TASKS_ADAT[akadTpl], ...TASKS_ADAT[resepsiTpl]];
  return [...TASKS_BASE, ...extra];
}

/** Rentang waktu checklist, dihitung dari jarak tenggat ke akad. */
export const TASK_RANGES: { id: string; title: string; min: number; max: number }[] = [
  { id: "r1", title: "6 bulan atau lebih", min: -10_000, max: -181 },
  { id: "r2", title: "3 sampai 6 bulan", min: -180, max: -91 },
  { id: "r3", title: "1 sampai 3 bulan", min: -90, max: -31 },
  { id: "r4", title: "Bulan terakhir", min: -30, max: -8 },
  { id: "r5", title: "Minggu terakhir dan hari-H", min: -7, max: 10_000 },
];

/* ---------- Budget ---------- */

export const DEFAULT_BUDGET: [string, number][] = [
  ["Gedung", 0.2],
  ["Catering", 0.38],
  ["Dekorasi", 0.12],
  ["Busana", 0.08],
  ["MUA dan paes", 0.06],
  ["Dokumentasi", 0.06],
  ["MC dan hiburan", 0.04],
  ["Souvenir", 0.03],
  ["Undangan", 0.03],
];

/* ---------- Dokumen nikah ---------- */

export const RELIGIONS = [
  { id: "islam", name: "Islam", office: "KUA" },
  { id: "kristen", name: "Kristen", office: "Dukcapil" },
  { id: "katolik", name: "Katolik", office: "Dukcapil" },
  { id: "hindu", name: "Hindu", office: "Dukcapil" },
  { id: "buddha", name: "Buddha", office: "Dukcapil" },
  { id: "konghucu", name: "Konghucu", office: "Dukcapil" },
] as const;

export const officeFor = (religion: string) => (religion === "islam" ? "KUA" : "Dukcapil");

const DOCS_KUA = [
  "KTP",
  "Kartu Keluarga",
  "Akta kelahiran",
  "Surat pengantar RT/RW",
  "Formulir N1 sampai N4 dari kelurahan",
  "Pas foto 2x3 dan 4x6 latar biru",
  "Sertifikat bimbingan perkawinan",
];

const DOCS_DUKCAPIL = [
  "KTP",
  "Kartu Keluarga",
  "Akta kelahiran",
  "Surat pengantar RT/RW dan kelurahan",
  "Surat keterangan perkawinan dari pemuka agama",
  "Pas foto berdampingan 4x6",
  "Fotokopi KTP dua orang saksi",
];

export function buildDocuments(religion: string) {
  return religion === "islam" ? DOCS_KUA : DOCS_DUKCAPIL;
}

export const DOC_STEPS: Record<"KUA" | "Dukcapil", { title: string; note: string }[]> = {
  KUA: [
    { title: "Kumpulkan dokumen dasar", note: "KTP, KK, dan akta" },
    { title: "Pengantar kelurahan", note: "Formulir N1 sampai N4" },
    { title: "Bimbingan perkawinan", note: "Dijadwalkan oleh KUA atau Kemenag" },
    { title: "Daftar ke KUA", note: "Paling lambat 10 hari kerja sebelum akad" },
    { title: "Akad dan buku nikah", note: "" },
  ],
  Dukcapil: [
    { title: "Kumpulkan dokumen dasar", note: "KTP, KK, dan akta" },
    { title: "Pemberkatan atau upacara agama", note: "Surat keterangan dari pemuka agama" },
    { title: "Lapor ke Dukcapil", note: "Paling lambat 60 hari setelah upacara" },
    { title: "Akta perkawinan terbit", note: "" },
  ],
};

export const GUEST_CATEGORIES = ["Keluarga", "Rekan ortu", "Kantor", "Teman", "Tetangga", "Lainnya"];
export const DELIVERY = [
  { id: "diantar", name: "Diantar" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "email", name: "Email" },
  { id: "pos", name: "Pos" },
];
export const GUEST_STATUS = [
  { id: "belum_kirim", name: "Belum dikirim", tone: "warn" },
  { id: "terkirim", name: "Terkirim", tone: "ok" },
  { id: "cek_jumlah", name: "Cek jumlah orang", tone: "info" },
] as const;

export const ACCENTS = [
  { id: "#D6F06B", name: "Lime" },
  { id: "#F6C9D0", name: "Rose" },
  { id: "#BFE3CF", name: "Sage" },
  { id: "#F5D78E", name: "Gold" },
];
