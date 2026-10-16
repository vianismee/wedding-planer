import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Tombol (DESIGN.md 6) ---------- */

type Variant = "primary" | "secondary" | "ground" | "outline" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2e2d40] active:bg-[#0f0e1a]",
  secondary: "bg-surface text-ink hover:bg-sunken",
  ground: "bg-ground text-ink hover:bg-[#e8e7ef]",
  outline: "border border-outline bg-transparent text-ink hover:bg-sunken",
  ghost: "bg-transparent text-ink hover:bg-ground",
  danger: "border border-[#f1c9c4] bg-surface text-danger hover:bg-[#fdf1ef]",
};

export function buttonClass(variant: Variant = "primary", size: "md" | "sm" = "md") {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:border disabled:border-[#d9d8e4] disabled:bg-transparent disabled:text-muted",
    size === "md" ? "h-11 px-4 text-[13px]" : "h-9 px-3 text-[12px]",
    VARIANT[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "md" | "sm" }) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "sm" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

/** Tombol ikon: wajib aria-label. Target sentuh 44px. */
export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors duration-150 hover:bg-ground disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Kartu ---------- */

export function Card({
  className,
  tone = "surface",
  ...props
}: ComponentProps<"section"> & { tone?: "surface" | "ink" | "sunken" }) {
  return (
    <section
      className={cx(
        "rounded-[22px] p-[18px] sm:p-5",
        tone === "surface" && "bg-surface",
        tone === "ink" && "on-ink bg-ink text-white",
        tone === "sunken" && "bg-sunken",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <h2 id={id} className="text-[18px] font-bold leading-tight">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/* ---------- Label status ---------- */

export type Tone = "ok" | "info" | "warn" | "neutral" | "accent" | "note";

const TONE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  info: "bg-info-bg text-info-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-ground text-ink",
  accent: "bg-accent text-ink",
  note: "bg-note-bg text-note-fg",
};

export function Status({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] font-bold leading-[1.4]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Header halaman ---------- */

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-[1.2] tracking-[-0.02em]">{title}</h1>
        {description && <p className="text-[14px] text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Isian form ---------- */

const inputBase =
  "w-full rounded-xl border border-transparent bg-ground px-3.5 text-[14px] text-ink placeholder:text-[#8a899c] transition-colors duration-150 hover:border-line focus:outline-none";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "min-h-20 py-2.5", className)} {...props} />;
}


/* ---------- Lain-lain ---------- */

export function Progress({ value, tone = "ink", className, label }: { value: number; tone?: "ink" | "accent"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("h-2 overflow-hidden rounded-full bg-ground", className)}
    >
      <div className={cx("h-full rounded-full", tone === "ink" ? "bg-ink" : "bg-accent")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[18px] bg-sunken p-5">
      <p className="text-[14px] font-bold">{title}</p>
      {children && <p className="max-w-prose text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Catatan sistem: Alert shadcn varian note. */
export function Note({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <Alert variant="note" role="note" className={cx("rounded-[18px] p-4", className)}>
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="font-normal">{children}</AlertDescription>
    </Alert>
  );
}

export function Avatar({ name, tone = "info", size = 36 }: { name: string; tone?: "info" | "ok" | "warn"; size?: number }) {
  const t = tone === "info" ? "bg-info-bg text-info-fg" : tone === "ok" ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold", t)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

/** Dua kolom label dan nilai, pengganti pemisah " · ". */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="truncate text-[13px] font-semibold">{children}</div>
    </div>
  );
}
