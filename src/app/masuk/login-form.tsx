"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Field, Input, cx } from "@/components/kit";

type Mode = "kode" | "sandi";

function passwordError(code: string | undefined, status: number) {
  if (status === 429) return "Terlalu banyak percobaan. Tunggu satu menit.";
  if (code?.startsWith("USER_ALREADY_EXISTS")) return "Email ini sudah terdaftar. Pilih Masuk, atau masuk dengan kode email.";
  if (code === "PASSWORD_TOO_SHORT") return "Kata sandi minimal 8 karakter.";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "CREDENTIAL_ACCOUNT_NOT_FOUND")
    return "Email atau kata sandi salah. Akun yang dibuat lewat kode email belum punya kata sandi, jadi masuk dengan kode email.";
  return "Gagal masuk. Periksa isian lalu coba lagi.";
}

export function LoginForm({ next, google }: { next: string; google: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("kode");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    router.push(next);
    router.refresh();
  };

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) return setError("Centang persetujuan kebijakan privasi dulu.");
    setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Terlalu sering meminta kode. Tunggu satu menit." : "Kode gagal dikirim. Periksa alamat email.");
    setStep("otp");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: otp.trim() });
    setBusy(false);
    if (error) return setError("Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.");
    done();
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (register && !agree) return setError("Centang persetujuan kebijakan privasi dulu.");
    setBusy(true);
    const { error } = register
      ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) return setError(passwordError(error.code, error.status));
    done();
  }

  const consent = (
    <label className="flex items-start gap-3 text-[13px] leading-[1.5]">
      <input
        type="checkbox"
        checked={agree}
        onChange={(e) => {
          setAgree(e.target.checked);
          if (e.target.checked) setError(null);
        }}
        className="mt-0.5 size-5 shrink-0 accent-[#1C1B29]"
      />
      <span>
        Saya setuju data pernikahan, tamu, dan dokumen saya diproses sesuai{" "}
        <a href="/privasi" className="font-semibold underline">
          kebijakan privasi
        </a>{" "}
        dan UU Pelindungan Data Pribadi.
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Cara masuk" className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1">
        {(
          [
            ["kode", "Kode email"],
            ["sandi", "Kata sandi"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cx(
              "h-10 rounded-[10px] text-[13px] font-bold transition-colors duration-150",
              mode === m ? "bg-ink text-white" : "text-ink hover:bg-surface",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "kode" && step === "email" && (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <p className="text-[13px] text-muted">Kami kirim kode 6 angka ke email kamu. Tidak perlu kata sandi.</p>
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </Field>
          {consent}
          <Button type="submit" disabled={busy}>
            {busy ? "Mengirim kode…" : "Kirim kode masuk"}
          </Button>
        </form>
      )}

      {mode === "kode" && step === "otp" && (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-[14px]">
            Kode dikirim ke <strong>{email}</strong>. Cek juga folder spam.
          </p>
          <Field label="Kode 6 angka">
            <Input
              required
             
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-[20px] font-bold tracking-[0.3em]"
            />
          </Field>
          <Button type="submit" disabled={busy || otp.length !== 6}>
            {busy ? "Memeriksa…" : "Masuk"}
          </Button>
          <Button
            variant="ground"
            onClick={() => {
              setStep("email");
              setOtp("");
            }}
          >
            Ganti email
          </Button>
        </form>
      )}

      {mode === "sandi" && (
        <form onSubmit={withPassword} className="flex flex-col gap-4">
          <p className="text-[13px] text-muted">
            {register
              ? "Daftar langsung dengan email dan kata sandi, tanpa verifikasi email."
              : "Masuk dengan email dan kata sandi yang sudah didaftarkan."}
          </p>
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </Field>
          <Field label="Kata sandi" hint={register ? "Minimal 8 karakter." : undefined}>
            <Input
              type="password"
              required
              minLength={register ? 8 : undefined}
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {register && consent}
          <Button type="submit" disabled={busy}>
            {busy ? "Memproses…" : register ? "Daftar" : "Masuk"}
          </Button>
          <p className="text-center text-[13px]">
            {register ? "Sudah punya akun? " : "Belum punya akun? "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError(null);
              }}
              className="font-semibold underline"
            >
              {register ? "Masuk" : "Daftar dengan kata sandi"}
            </button>
          </p>
        </form>
      )}

      {error && (
        <Alert variant="warn">
<AlertDescription>{error}</AlertDescription>
</Alert>
      )}

      {google && (mode === "sandi" || step === "email") && (
        <>
          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span className="h-px flex-1 bg-line" />
            atau
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (!agree) return setError("Centang persetujuan kebijakan privasi dulu.");
              authClient.signIn.social({ provider: "google", callbackURL: next });
            }}
          >
            Lanjut dengan Google
          </Button>
        </>
      )}
    </div>
  );
}
