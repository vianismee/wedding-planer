import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  date,
  index,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);
const weddingRef = () =>
  text("wedding_id")
    .notNull()
    .references(() => wedding.id, { onDelete: "cascade" });

/* ---------- Better Auth ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ---------- Ruang pernikahan ---------- */

export const wedding = pgTable("wedding", {
  id: id(),
  groomName: text("groom_name").notNull(),
  brideName: text("bride_name").notNull(),
  akadDate: date("akad_date", { mode: "string" }).notNull(),
  city: text("city").notNull(),
  akadTemplate: text("akad_template").notNull(), // jawa | sunda | nasional
  resepsiTemplate: text("resepsi_template").notNull(),
  religion: text("religion").notNull().default("islam"),
  officeName: text("office_name"), // KUA / Dukcapil kecamatan
  accent: text("accent").notNull().default("#D6F06B"),
  quotaGroom: integer("quota_groom").notNull().default(300),
  quotaBride: integer("quota_bride").notNull().default(300),
  paymentStatus: text("payment_status").notNull().default("free"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
});

export const member = pgTable(
  "member",
  {
    id: id(),
    weddingId: weddingRef(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // pemilik | pasangan | keluarga | panitia
    // Menu pilihan untuk capsule nav di HP (maksimal 4). Null = urutan bawaan.
    capsuleItems: jsonb("capsule_items").$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("member_wedding_user_uq").on(t.weddingId, t.userId)],
);

export const invite = pgTable(
  "invite",
  {
    id: id(),
    weddingId: weddingRef(),
    token: text("token").notNull().unique(),
    email: text("email"),
    role: text("role").notNull(),
    createdBy: text("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invite_wedding_idx").on(t.weddingId)],
);

/* ---------- Acara & rundown ---------- */

export const event = pgTable(
  "event",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("lainnya"), // akad | resepsi | lamaran | adat | pengajian | lainnya
    date: date("date", { mode: "string" }),
    startTime: text("start_time"),
    location: text("location"),
    estimatedGuests: integer("estimated_guests"),
    status: text("status").notNull().default("persiapan"), // persiapan | lokasi_belum | selesai
    sortOrder: integer("sort_order").notNull().default(0),
    shareToken: text("share_token").unique(),
    createdAt: createdAt(),
  },
  (t) => [index("event_wedding_idx").on(t.weddingId)],
);

export const rundownItem = pgTable(
  "rundown_item",
  {
    id: id(),
    weddingId: weddingRef(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    time: text("time").notNull(),
    activity: text("activity").notNull(),
    pic: text("pic"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("rundown_event_idx").on(t.eventId)],
);

/* ---------- Tamu ---------- */

export const guest = pgTable(
  "guest",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    note: text("note"),
    category: text("category").notNull().default("Keluarga"),
    side: text("side").notNull(), // pria | wanita
    session: text("session").notNull().default("Sesi 1"),
    pax: integer("pax").notNull().default(2),
    delivery: text("delivery").notNull().default("diantar"), // diantar | whatsapp | email | pos
    status: text("status").notNull().default("belum_kirim"), // belum_kirim | terkirim | cek_jumlah
    vip: boolean("vip").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("guest_wedding_idx").on(t.weddingId)],
);

/* ---------- Budget ---------- */

export const budgetCategory = pgTable(
  "budget_category",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    allocation: money("allocation"),
    need: text("need"), // kebutuhan, dipakai di perbandingan penawaran
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("budget_category_wedding_idx").on(t.weddingId)],
);

export const fundingSource = pgTable(
  "funding_source",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    side: text("side").notNull().default("pengantin"), // pengantin | pria | wanita | lainnya
    amount: money("amount"),
  },
  (t) => [index("funding_wedding_idx").on(t.weddingId)],
);

export const file = pgTable(
  "file",
  {
    id: id(),
    weddingId: weddingRef(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    kind: text("kind").notNull(), // receipt | document | offer
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("file_wedding_idx").on(t.weddingId)],
);

export const expense = pgTable(
  "expense",
  {
    id: id(),
    weddingId: weddingRef(),
    categoryId: text("category_id").references(() => budgetCategory.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amount: money("amount"),
    date: date("date", { mode: "string" }).notNull(),
    fundingSourceId: text("funding_source_id").references(() => fundingSource.id, { onDelete: "set null" }),
    receiptFileId: text("receipt_file_id").references(() => file.id, { onDelete: "set null" }),
    paymentTermId: text("payment_term_id"),
    createdAt: createdAt(),
  },
  (t) => [index("expense_wedding_idx").on(t.weddingId)],
);

/* ---------- Vendor ---------- */

export const offer = pgTable(
  "offer",
  {
    id: id(),
    weddingId: weddingRef(),
    categoryId: text("category_id")
      .notNull()
      .references(() => budgetCategory.id, { onDelete: "cascade" }),
    vendorName: text("vendor_name").notNull(),
    packageName: text("package_name"),
    price: money("price"), // harga paket
    // Isi paket sebagai daftar, dan add-on di luar paket. Total = price + jumlah add-on.
    includeItems: jsonb("include_items").$type<string[]>().notNull().default([]),
    addons: jsonb("addons").$type<OfferAddon[]>().notNull().default([]),
    dpPercent: integer("dp_percent").notNull().default(30),
    // Cara DP: persen dari total, nominal tetap, atau tanpa DP.
    dpType: text("dp_type").notNull().default("percent"), // percent | nominal | none
    dpAmount: money("dp_amount"),
    availability: text("availability"),
    available: boolean("available").notNull().default(true),
    notes: text("notes"),
    contact: text("contact"),
    attachmentFileId: text("attachment_file_id").references(() => file.id, { onDelete: "set null" }),
    status: text("status").notNull().default("dibandingkan"), // dibandingkan | dipilih
    createdAt: createdAt(),
  },
  (t) => [index("offer_wedding_idx").on(t.weddingId)],
);

export const vendor = pgTable(
  "vendor",
  {
    id: id(),
    weddingId: weddingRef(),
    categoryId: text("category_id").references(() => budgetCategory.id, { onDelete: "set null" }),
    offerId: text("offer_id").references(() => offer.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    packageName: text("package_name"),
    packagePrice: money("package_price"),
    includeItems: jsonb("include_items").$type<string[]>().notNull().default([]),
    addons: jsonb("addons").$type<OfferAddon[]>().notNull().default([]),
    packageDesc: text("package_desc"), // catatan bebas
    contact: text("contact"),
    totalPrice: money("total_price"), // = harga paket + add-on
    shareToken: text("share_token").unique(), // link ringkasan untuk vendor
    createdAt: createdAt(),
  },
  (t) => [index("vendor_wedding_idx").on(t.weddingId)],
);

export const paymentTerm = pgTable(
  "payment_term",
  {
    id: id(),
    weddingId: weddingRef(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // DP | Termin 2 | Pelunasan
    amount: money("amount"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: date("paid_at", { mode: "string" }),
    remindedH7: boolean("reminded_h7").notNull().default(false),
    remindedH1: boolean("reminded_h1").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("term_wedding_idx").on(t.weddingId), index("term_due_idx").on(t.dueDate)],
);

/* ---------- Checklist ---------- */

export const task = pgTable(
  "task",
  {
    id: id(),
    weddingId: weddingRef(),
    title: text("title").notNull(),
    pic: text("pic"),
    assigneeMemberId: text("assignee_member_id").references(() => member.id, { onDelete: "set null" }),
    // Tenggat disimpan relatif terhadap tanggal akad, sehingga ikut bergeser bila akad diubah.
    offsetDays: integer("offset_days").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("task_wedding_idx").on(t.weddingId)],
);

/* ---------- Seserahan & mahar ---------- */

export const seserahanItem = pgTable(
  "seserahan_item",
  {
    id: id(),
    weddingId: weddingRef(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("belum"), // belum | dipesan | terbeli
    price: money("price"),
    pic: text("pic"),
    note: text("note"),
    purchaseUrl: text("purchase_url"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("seserahan_wedding_idx").on(t.weddingId)],
);

// Mahar bisa terdiri dari beberapa item (misalnya emas dan seperangkat alat salat).
export const maharItem = pgTable(
  "mahar_item",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    value: money("value"),
    status: text("status").notNull().default("belum"), // belum | terbeli
    keeper: text("keeper"),
    purchaseUrl: text("purchase_url"),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("mahar_item_wedding_idx").on(t.weddingId)],
);

/* ---------- Dokumen nikah ---------- */

export const document = pgTable(
  "document",
  {
    id: id(),
    weddingId: weddingRef(),
    person: text("person").notNull(), // pria | wanita
    name: text("name").notNull(),
    status: text("status").notNull().default("belum"), // belum | diproses | lengkap
    fileId: text("file_id").references(() => file.id, { onDelete: "set null" }),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("document_wedding_idx").on(t.weddingId)],
);

/* ---------- Jadwal kustom (test food, fitting, survey, meeting vendor) ---------- */

export const schedule = pgTable(
  "schedule",
  {
    id: id(),
    weddingId: weddingRef(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("lainnya"), // test_food | fitting | survey | meeting | lainnya
    date: date("date", { mode: "string" }).notNull(),
    startTime: text("start_time"),
    location: text("location"),
    vendorId: text("vendor_id").references(() => vendor.id, { onDelete: "set null" }),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("schedule_wedding_idx").on(t.weddingId), index("schedule_date_idx").on(t.date)],
);

/* ---------- Kalkulator catering ---------- */

export type CateringExtra = { label: string; qty: number; price: number };
export type OfferAddon = { label: string; qty: number; price: number };

export const cateringPlan = pgTable(
  "catering_plan",
  {
    id: id(),
    weddingId: weddingRef(),
    name: text("name").notNull(),
    mode: text("mode").notNull(), // per_pax | masak_sendiri
    paxSource: text("pax_source").notNull().default("tamu"), // tamu | manual
    manualPax: integer("manual_pax").notNull().default(0),
    bufferPercent: integer("buffer_percent").notNull().default(10),
    // per pax
    pricePerPax: money("price_per_pax"),
    // masak sendiri
    ingredientPerPax: money("ingredient_per_pax"),
    cooks: integer("cooks").notNull().default(0),
    cookWage: money("cook_wage"), // upah per orang per hari
    cookDays: integer("cook_days").notNull().default(1),
    equipmentCost: money("equipment_cost"),
    // keduanya
    extras: jsonb("extras").$type<CateringExtra[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("catering_wedding_idx").on(t.weddingId)],
);

/* ---------- Moodboard ---------- */

// Satu foto atau video di kartu media (impor dari link). w dan h ukuran asli, untuk rasio kartu.
export type MoodMedia = { fileId: string; kind: "image" | "video"; w?: number; h?: number };

export type MoodNode = {
  id: string;
  type: "photo" | "note" | "palette" | "text" | "shape" | "draw" | "media";
  x: number;
  y: number;
  // Ukuran bebas setelah di-resize. Kosong = ukuran bawaan tipe kartu.
  w?: number;
  h?: number;
  title: string;
  text?: string;
  fileId?: string;
  // Cara foto mengisi kartu: "cover" dipotong mengikuti titik fokus (persen), "contain" tampil utuh.
  fit?: "cover" | "contain";
  focus?: { x: number; y: number };
  swatches?: string[];
  tags: string[];
  // Teks bebas di kanvas.
  font?: string;
  fontSize?: number;
  weight?: 400 | 700;
  align?: "left" | "center" | "right";
  // Warna teks, garis bentuk, atau tinta pena.
  color?: string;
  // Bentuk: garis dan panah memakai `points` (x1 y1 x2 y2).
  shape?: "rect" | "ellipse" | "line" | "arrow";
  fill?: string;
  strokeWidth?: number;
  // Goresan pena dan garis: titik dalam kotak vw x vh, ditarik mengikuti w x h saat di-resize.
  points?: number[];
  vw?: number;
  vh?: number;
  // Kartu media: link asal (Instagram, Pinterest, dll.) dan isinya. Lebih dari satu = carousel.
  url?: string;
  media?: MoodMedia[];
};
export type MoodEdge = { id: string; from: string; to: string; label: string };
export type MoodGroup = { id: string; x: number; y: number; w: number; h: number; title: string; color: string };
export type MoodData = { nodes: MoodNode[]; edges: MoodEdge[]; groups: MoodGroup[] };

// Satu baris per papan (utama, akad, resepsi). `rev` naik tiap simpan, supaya simpanan
// dari dua anggota yang mengubah papan yang sama tidak saling menimpa diam-diam.
export const moodboard = pgTable(
  "moodboard",
  {
    id: id(),
    weddingId: weddingRef(),
    board: text("board").notNull(),
    data: jsonb("data").$type<MoodData>().notNull(),
    rev: integer("rev").notNull().default(0),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    shareToken: text("share_token").unique(), // link baca-saja untuk vendor
  },
  (t) => [uniqueIndex("moodboard_wedding_board_idx").on(t.weddingId, t.board)],
);

export type Wedding = typeof wedding.$inferSelect;
export type Member = typeof member.$inferSelect;
export type Event = typeof event.$inferSelect;
export type RundownItem = typeof rundownItem.$inferSelect;
export type Guest = typeof guest.$inferSelect;
export type BudgetCategory = typeof budgetCategory.$inferSelect;
export type FundingSource = typeof fundingSource.$inferSelect;
export type Expense = typeof expense.$inferSelect;
export type Offer = typeof offer.$inferSelect;
export type Vendor = typeof vendor.$inferSelect;
export type PaymentTerm = typeof paymentTerm.$inferSelect;
export type Task = typeof task.$inferSelect;
export type SeserahanItem = typeof seserahanItem.$inferSelect;
export type MaharItem = typeof maharItem.$inferSelect;
export type Document = typeof document.$inferSelect;
export type Schedule = typeof schedule.$inferSelect;
export type CateringPlan = typeof cateringPlan.$inferSelect;
