"use client";

import { startTransition, useActionState, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "./confirm";
import { Button, buttonClass, cx } from "./kit";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
type FormAction = (fd: FormData) => Promise<ActionResult>;

/**
 * Kirim form tanpa reset otomatis React 19 (yang menghapus isian walau server menolak).
 * Pakai sebagai onSubmit dengan dispatch dari useActionState.
 */
export function submitWith(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}

export function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (!state.ok)
    return (
      <Alert variant="warn">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  if (state.message)
    return (
      <Alert variant="ok">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  return null;
}

/* ---------- Modal: Dialog shadcn yang disesuaikan ---------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={wide ? "max-w-[880px]" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Form di dalam dialog ---------- */

export function FormDialog({
  trigger,
  triggerLabel,
  variant = "primary",
  size = "md",
  triggerClassName,
  title,
  description,
  action,
  submitLabel = "Simpan",
  children,
  wide,
  footer,
}: {
  trigger: ReactNode;
  triggerLabel?: string;
  variant?: "primary" | "secondary" | "ground" | "outline" | "ghost" | "icon";
  size?: "md" | "sm";
  triggerClassName?: string;
  title: string;
  description?: ReactNode;
  action: FormAction;
  submitLabel?: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (_prev: ActionResult | null, fd: FormData) => {
    const r = await action(fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen(true)}
        className={cx(
          variant === "icon"
            ? "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors duration-150 hover:bg-ground"
            : buttonClass(variant, size),
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} wide={wide}>
        <form onSubmit={submitWith(formAction)} className="flex flex-col gap-4">
          {children}
          {state && !state.ok && <Feedback state={state} />}
          <DialogFooter>
            {footer}
            <Button variant="ground" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </Modal>
    </>
  );
}

/* ---------- Form biasa (di halaman) ---------- */

export function ActionForm({
  action,
  children,
  submitLabel = "Simpan",
  resetOnSuccess,
  className,
  submitVariant = "primary",
  inlineSubmit,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitVariant?: "primary" | "secondary" | "ground";
  inlineSubmit?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: ActionResult | null, fd: FormData) => {
    const r = await action(fd);
    // Remount isi form supaya select dan tanggal kustom ikut kembali ke nilai awal.
    if (r.ok && resetOnSuccess) setKey((k) => k + 1);
    return r;
  }, null);
  return (
    <form ref={ref} onSubmit={submitWith(formAction)} className={cx("flex flex-col gap-4", className)}>
      {inlineSubmit ? (
        <div key={key} className="flex flex-wrap items-end gap-2">
          {children}
          <Button type="submit" variant={submitVariant} disabled={pending}>
            {pending ? "Menyimpan…" : submitLabel}
          </Button>
        </div>
      ) : (
        <>
          <div key={key} className="contents">
            {children}
          </div>
          <div>
            <Button type="submit" variant={submitVariant} disabled={pending}>
              {pending ? "Menyimpan…" : submitLabel}
            </Button>
          </div>
        </>
      )}
      <Feedback state={state} />
    </form>
  );
}

/* ---------- Tombol yang menjalankan aksi ---------- */

export function ActionButton({
  action,
  children,
  confirm,
  confirmLabel = "Hapus",
  variant = "secondary",
  size = "md",
  label,
  className,
  pressed,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "ground" | "outline" | "ghost" | "danger" | "icon";
  size?: "md" | "sm";
  label?: string;
  className?: string;
  pressed?: boolean;
}) {
  const [pending, start] = useTransition();
  const dialogs = useConfirm();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={pending}
      onClick={async () => {
        if (confirm && !(await dialogs.confirm({ title: confirm, confirmLabel, destructive: confirmLabel === "Hapus" })))
          return;
        start(async () => {
          const r = await action();
          if (!r.ok) await dialogs.alert({ title: "Belum berhasil", description: r.error });
        });
      }}
      className={cx(
        variant === "icon"
          ? "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors duration-150 hover:bg-ground disabled:opacity-50"
          : buttonClass(variant, size),
        className,
      )}
    >
      {children}
    </button>
  );
}
