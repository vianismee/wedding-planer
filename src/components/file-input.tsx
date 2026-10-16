"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useId, useState } from "react";
import { Paperclip, X } from "lucide-react";

/** Mengunggah file ke /api/upload lalu menaruh id-nya di input tersembunyi `name`. */
export function FileInput({
  name,
  kind,
  label = "Lampiran",
  accept = "image/*,application/pdf",
  current,
}: {
  name: string;
  kind: "receipt" | "offer" | "document";
  label?: string;
  accept?: string;
  current?: { id: string; name: string } | null;
}) {
  const inputId = useId();
  const [file, setFile] = useState<{ id: string; name: string } | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", f);
    fd.set("kind", kind);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload gagal");
      setFile({ id: data.id, name: data.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <input type="hidden" name={name} value={file?.id ?? ""} />
      {file ? (
        <div className="flex items-center gap-2 rounded-xl bg-ground px-3.5 py-2">
          <Paperclip size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Lepas lampiran"
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-outline px-3.5 text-[13px] font-semibold text-muted hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
        >
          <Paperclip size={16} aria-hidden="true" />
          {busy ? "Mengunggah…" : "Pilih foto atau PDF, maksimal 10 MB"}
          <input
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && (
        <Alert variant="warn" className="bg-transparent p-0">
<AlertDescription>{error}</AlertDescription>
</Alert>
      )}
    </div>
  );
}
