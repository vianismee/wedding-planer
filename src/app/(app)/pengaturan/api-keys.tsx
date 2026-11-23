"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createApiKey } from "@/actions/api";
import { submitWith, type ActionResult } from "@/components/forms";
import { Button, Field, Input, Textarea } from "@/components/kit";
import { SelectField } from "@/components/select-field";
import { CopyLink } from "@/components/copy-link";

/** Form kunci baru. Kunci utuh hanya ditampilkan sekali setelah dibuat. */
export function ApiKeyCreate() {
  const [kind, setKind] = useState("undangan");
  const [form, setForm] = useState(0);
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await createApiKey(fd);
    if (r.ok) setForm((k) => k + 1);
    return r;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <form key={form} onSubmit={submitWith(action)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama kunci" hint="Untuk mengenali kunci, misalnya Undangan web.">
            <Input name="name" required maxLength={60} placeholder="Undangan web" />
          </Field>
          <Field label="Jenis">
            <SelectField
              name="kind"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "undangan", label: "Undangan (boleh di browser)" },
                { value: "server", label: "Server (akses penuh tamu)" },
              ]}
            />
          </Field>
        </div>
        {kind === "undangan" ? (
          <Field label="Domain undangan (opsional)" hint="Satu per baris, misalnya https://undangan.contoh.com. Kosongkan agar semua domain boleh.">
            <Textarea name="origins" rows={2} placeholder="https://undangan.contoh.com" />
          </Field>
        ) : (
          <p className="text-[13px] text-muted">
            Kunci server bisa membaca nomor HP dan alamat tamu serta mengubah daftar tamu. Simpan hanya di backend, jangan di kode halaman web.
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Membuat…" : "Buat kunci"}
          </Button>
        </div>
      </form>
      {state && !state.ok && (
        <Alert variant="warn">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok && state.message && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-sunken p-3">
          <p className="text-[13px] font-bold">Salin kunci ini sekarang. Kunci tidak akan ditampilkan lagi.</p>
          <CopyLink url={state.message} />
        </div>
      )}
    </div>
  );
}
