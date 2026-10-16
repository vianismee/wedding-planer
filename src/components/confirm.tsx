"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};
type AlertOptions = { title: string; description?: ReactNode; okLabel?: string };

type Ctx = {
  confirm: (o: ConfirmOptions | string) => Promise<boolean>;
  alert: (o: AlertOptions | string) => Promise<void>;
};

const ConfirmContext = createContext<Ctx | null>(null);

type State =
  | { kind: "confirm"; o: ConfirmOptions }
  | { kind: "alert"; o: AlertOptions }
  | null;

/** Pengganti window.confirm dan window.alert memakai AlertDialog shadcn. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };

  const confirm = useCallback((o: ConfirmOptions | string) => {
    setState({ kind: "confirm", o: typeof o === "string" ? { title: o } : o });
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);

  const alert = useCallback((o: AlertOptions | string) => {
    setState({ kind: "alert", o: typeof o === "string" ? { title: o } : o });
    return new Promise<void>((res) => (resolver.current = () => res()));
  }, []);

  return (
    <ConfirmContext value={{ confirm, alert }}>
      {children}
      <AlertDialog open={state !== null} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.o.title}</AlertDialogTitle>
            {state?.o.description ? (
              <AlertDialogDescription>{state.o.description}</AlertDialogDescription>
            ) : (
              <AlertDialogDescription className="sr-only">{state?.o.title}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {state?.kind === "confirm" ? (
              <>
                <AlertDialogCancel onClick={() => close(false)}>{state.o.cancelLabel ?? "Batal"}</AlertDialogCancel>
                <AlertDialogAction variant={state.o.destructive ? "destructive" : "default"} onClick={() => close(true)}>
                  {state.o.confirmLabel ?? "Lanjutkan"}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => close(true)}>
                {state?.kind === "alert" ? state.o.okLabel ?? "Mengerti" : "Mengerti"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm harus dipakai di dalam ConfirmProvider");
  return ctx;
}
