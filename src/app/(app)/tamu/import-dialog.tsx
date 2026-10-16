"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useId, useMemo, useState, useTransition } from "react";
import { importGuests } from "@/actions/tamu";
import { Modal } from "@/components/forms";
import { Button, Field, Status } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { number } from "@/lib/format";

type Parsed = {
  name: string;
  note: string | null;
  category: string;
  side: "pria" | "wanita" | null;
  session: string;
  pax: number;
  delivery: "diantar" | "whatsapp" | "email" | "pos";
};

// Nama kolom yang dikenali (huruf kecil, tanpa spasi berlebih).
const COLS: Record<keyof Parsed, string[]> = {
  name: ["nama", "nama tamu", "name", "tamu"],
  note: ["keterangan", "catatan", "alamat", "hubungan", "note", "kota"],
  category: ["kategori", "category", "kelompok"],
  side: ["pihak", "side", "dari"],
  session: ["sesi", "session"],
  pax: ["jumlah", "jumlah orang", "orang", "pax", "jml"],
  delivery: ["kirim", "kirim via", "via", "cara kirim", "pengiriman"],
};

function normSide(v: string): "pria" | "wanita" | null {
  const s = v.toLowerCase();
  if (/(pria|laki|cowok|groom|cpp|lk)/.test(s)) return "pria";
  if (/(wanita|perempuan|cewek|bride|cpw|pr)/.test(s)) return "wanita";
  return null;
}

function normDelivery(v: string): Parsed["delivery"] {
  const s = v.toLowerCase();
  if (s.includes("wa") || s.includes("whats")) return "whatsapp";
  if (s.includes("mail")) return "email";
  if (s.includes("pos")) return "pos";
  return "diantar";
}

const keyOf = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function ImportDialog({ open, onClose, existingNames }: { open: boolean; onClose: () => void; existingNames: Set<string> }) {
  const inputId = useId();
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [defaultSide, setDefaultSide] = useState<"pria" | "wanita">("wanita");
  const [skipDup, setSkipDup] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function parse(file: File) {
    setError(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (data.length === 0) throw new Error("File kosong atau baris pertama bukan judul kolom.");
      const headers = Object.keys(data[0]);
      const find = (k: keyof Parsed) => headers.find((h) => COLS[k].includes(keyOf(h)));
      const col = Object.fromEntries((Object.keys(COLS) as (keyof Parsed)[]).map((k) => [k, find(k)])) as Record<keyof Parsed, string | undefined>;
      if (!col.name) throw new Error('Kolom "Nama" tidak ditemukan. Pastikan baris pertama berisi judul kolom, misalnya Nama, Pihak, Jumlah.');
      const cell = (r: Record<string, unknown>, k: keyof Parsed) => (col[k] ? String(r[col[k]!] ?? "").trim() : "");
      const parsed: Parsed[] = data
        .map((r) => ({
          name: cell(r, "name").slice(0, 120),
          note: cell(r, "note").slice(0, 160) || null,
          category: cell(r, "category").slice(0, 40) || "Lainnya",
          side: normSide(cell(r, "side")),
          session: cell(r, "session").slice(0, 40) || "Sesi 1",
          pax: Math.min(500, Math.max(1, parseInt(cell(r, "pax"), 10) || 2)),
          delivery: normDelivery(cell(r, "delivery")),
        }))
        .filter((r) => r.name);
      if (parsed.length > 5000) throw new Error("Maksimal 5.000 baris per import. Pecah file menjadi beberapa bagian.");
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "File tidak bisa dibaca. Simpan ulang sebagai .xlsx atau .csv.");
    }
  }

  // Deteksi duplikat: nama yang sudah ada di daftar, atau muncul lebih dari sekali di file.
  const analysed = useMemo(() => {
    if (!rows) return [];
    const seen = new Set<string>();
    return rows.map((r) => {
      const k = keyOf(r.name);
      const dup = existingNames.has(k) ? "Sudah ada di daftar" : seen.has(k) ? "Ganda di file" : null;
      seen.add(k);
      return { ...r, dup };
    });
  }, [rows, existingNames]);

  const toImport = analysed.filter((r) => !(skipDup && r.dup));
  const dupCount = analysed.filter((r) => r.dup).length;

  function close() {
    setRows(null);
    setError(null);
    setResult(null);
    onClose();
  }

  function submit() {
    start(async () => {
      const payload = toImport.map(({ name, note, category, side, session, pax, delivery }) => ({
        name, note, category, session, pax, delivery, side: side ?? defaultSide,
      }));
      const r = await importGuests(payload);
      if (!r.ok) return setError(r.error);
      setResult(r.message ?? "Import selesai.");
      setRows(null);
    });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import tamu dari Excel atau CSV"
      description="Baris pertama berisi judul kolom. Kolom yang dikenali: Nama, Keterangan, Kategori, Pihak, Sesi, Jumlah, Kirim via."
    >
      <div className="flex flex-col gap-4">
        {result && (
          <Alert variant="ok">
<AlertDescription>{result}</AlertDescription>
</Alert>
        )}
        <label
          htmlFor={inputId}
          className="flex min-h-14 cursor-pointer items-center justify-center rounded-[18px] border-2 border-dashed border-outline px-4 text-center text-[14px] font-semibold hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
        >
          {fileName && rows ? `${fileName}, pilih file lain` : "Pilih file .xlsx, .xls, atau .csv"}
          <input
            id={inputId}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parse(f);
              e.target.value = "";
            }}
          />
        </label>

        {error && (
          <Alert variant="warn">
<AlertDescription>{error}</AlertDescription>
</Alert>
        )}

        {rows && (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Pihak untuk baris tanpa kolom pihak" className="w-56">
                <SelectField value={defaultSide} onValueChange={(v) => setDefaultSide(v as "pria" | "wanita")} options={[{ value: "pria", label: "Pria" }, { value: "wanita", label: "Wanita" }]} />
              </Field>
              <label className="flex h-11 items-center gap-3 text-[14px] font-semibold">
                <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="size-5 accent-[#1C1B29]" />
                Lewati {number(dupCount)} nama duplikat
              </label>
            </div>
            <p className="text-[13px] text-muted">
              Pratinjau {number(analysed.length)} baris. {number(toImport.length)} akan diimport.
            </p>
            <div className="max-h-[320px] overflow-auto rounded-[14px] border border-line">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-[12px] text-muted">
                    {["Nama", "Kategori", "Pihak", "Sesi", "Orang", "Cek"].map((h) => (
                      <th key={h} scope="col" className="border-b border-line px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysed.slice(0, 200).map((r, i) => (
                    <tr key={i} className={r.dup && skipDup ? "text-muted line-through" : ""}>
                      <td className="border-b border-ground px-3 py-1.5 font-semibold">{r.name}</td>
                      <td className="border-b border-ground px-3 py-1.5">{r.category}</td>
                      <td className="border-b border-ground px-3 py-1.5">{r.side ?? `${defaultSide} (bawaan)`}</td>
                      <td className="border-b border-ground px-3 py-1.5">{r.session}</td>
                      <td className="border-b border-ground px-3 py-1.5">{r.pax}</td>
                      <td className="border-b border-ground px-3 py-1.5">{r.dup && <Status tone="warn">{r.dup}</Status>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analysed.length > 200 && <p className="text-[12px] text-muted">Pratinjau menampilkan 200 baris pertama.</p>}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ground" onClick={close}>
            {result ? "Selesai" : "Batal"}
          </Button>
          {rows && (
            <Button onClick={submit} disabled={pending || toImport.length === 0}>
              {pending ? "Mengimport…" : `Import ${number(toImport.length)} tamu`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
