"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/actions/anggota";
import { Button } from "@/components/kit";

export function AcceptButton({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">Masuk sebagai {email}.</p>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (!r.ok) return setError(r.error);
            router.push("/dashboard");
          })
        }
      >
        {pending ? "Bergabung…" : "Terima undangan"}
      </Button>
      {error && (
        <Alert variant="warn">
<AlertDescription>{error}</AlertDescription>
</Alert>
      )}
    </div>
  );
}
