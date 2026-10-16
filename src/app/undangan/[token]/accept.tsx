"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { acceptInvite } from "@/actions/anggota";
import { Button } from "@/components/kit";

/**
 * Tombol terima undangan. Dengan `auto`, undangan langsung diterima saat halaman dibuka
 * (dipakai setelah tamu mendaftar atau masuk dari link undangan).
 */
export function AcceptButton({ token, email, auto }: { token: string; email: string; auto?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const accept = () =>
    start(async () => {
      const r = await acceptInvite(token);
      if (!r.ok) return setError(r.error);
      router.replace("/dashboard");
      router.refresh();
    });

  useEffect(() => {
    if (auto && !ran.current) {
      ran.current = true;
      accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">Masuk sebagai {email}.</p>
      <Button disabled={pending} onClick={accept}>
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

/** Mengingat token undangan di browser, supaya onboarding bisa menawarkan undangan ini bila tamu tersesat. */
export function RememberInvite({ token }: { token: string }) {
  useEffect(() => {
    document.cookie = `rukun_invite=${token}; path=/; max-age=${60 * 60 * 24 * 14}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, [token]);
  return null;
}
