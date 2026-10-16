"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWedding, switchWedding } from "@/actions/wedding";
import { type ActionResult, submitWith } from "@/components/forms";
import { useConfirm } from "@/components/confirm";
import { Button, Field, Input} from "@/components/kit";
import { SelectField } from "@/components/select-field";

export function WeddingSwitcher({ current, weddings }: { current: string; weddings: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (weddings.length < 2) return null;
  return (
    <Field label="Ruang pernikahan aktif">
      <SelectField
        value={current}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            await switchWedding(v);
            router.push("/dashboard");
          })
        } options={[...weddings.map((w) => ({ value: w.id, label: w.name }))]} />
    </Field>
  );
}

export function DangerZone({ confirmText }: { confirmText: string }) {
  const router = useRouter();
  const dialogs = useConfirm();
  const [state, action, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const yes = await dialogs.confirm({
      title: "Hapus ruang pernikahan secara permanen?",
      description: "Semua acara, tamu, budget, vendor, dan scan dokumen akan dihapus dan tidak bisa dipulihkan.",
      confirmLabel: "Hapus permanen",
      destructive: true,
    });
    if (!yes) return null;
    const r = await deleteWedding(fd);
    if (r.ok) router.push("/onboarding");
    return r;
  }, null);
  return (
    <details className="rounded-[14px] border border-[#f1c9c4] p-3">
      <summary className="cursor-pointer text-[13px] font-bold text-danger">Hapus ruang pernikahan</summary>
      <form onSubmit={submitWith(action)} className="mt-3 flex flex-col gap-3">
        <Field label={`Ketik "${confirmText}" untuk konfirmasi`}>
          <Input name="confirm" required autoComplete="off" />
        </Field>
        {state && !state.ok && (
          <Alert variant="warn" className="bg-transparent p-0">
<AlertDescription>{state.error}</AlertDescription>
</Alert>
        )}
        <Button type="submit" variant="danger" disabled={pending} className="self-start">
          {pending ? "Menghapus…" : "Hapus permanen"}
        </Button>
      </form>
    </details>
  );
}
