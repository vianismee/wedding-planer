"use client";

import { useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: ReactNode };

// Radix Select tidak menerima nilai kosong, jadi "" dipetakan ke penanda ini.
const EMPTY = "__kosong__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

/**
 * Select shadcn untuk form dan filter.
 * Dengan `name`, nilainya ikut terkirim di FormData lewat input tersembunyi.
 */
export function SelectField({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pilih",
  size = "default",
  disabled,
  className,
  contentClassName,
  id,
  "aria-label": ariaLabel,
}: {
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Select
        value={toRadix(current)}
        disabled={disabled}
        onValueChange={(v) => {
          const next = fromRadix(v);
          if (value === undefined) setInner(next);
          onValueChange?.(next);
        }}
      >
        <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn("min-w-(--radix-select-trigger-width)", contentClassName)}>
          {options.map((o) => (
            <SelectItem key={o.value} value={toRadix(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
