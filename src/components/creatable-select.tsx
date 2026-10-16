"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Combobox shadcn (Popover + Command): pilih dari daftar yang ada,
 * atau ketik nilai baru lalu pilih "Tambah". Nilai dikirim lewat input tersembunyi `name`.
 */
export function CreatableSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Pilih",
  searchPlaceholder = "Cari atau ketik baru",
  createLabel = "Tambah",
  emptyText = "Belum ada pilihan. Ketik untuk menambah.",
  className,
  id,
  "aria-label": ariaLabel,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  createLabel?: string;
  emptyText?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Nilai baru yang sudah dipilih tetap tampil di daftar.
  const list = [...new Set([...options, ...(value ? [value] : [])])];
  const typed = query.trim();
  const exists = list.some((o) => o.toLowerCase() === typed.toLowerCase());

  const pick = (v: string) => {
    setValue(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            data-slot="select-trigger"
            className={cn(
              "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-transparent bg-ground px-3.5 text-left text-[14px] transition-colors duration-150 hover:border-line",
              !value && "text-[#8a899c]",
              className,
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent id={listId} align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
            <CommandList>
              {!typed && <CommandEmpty>{emptyText}</CommandEmpty>}
              {list.length > 0 && (
                <CommandGroup>
                  {list.map((o) => (
                    <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                      <span className="min-w-0 flex-1 truncate">{o}</span>
                      {o === value && <Check aria-hidden="true" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {typed && !exists && (
                <CommandGroup forceMount>
                  <CommandItem forceMount value={`__baru__${typed}`} onSelect={() => pick(typed)} className="font-semibold">
                    <Plus aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {createLabel} &quot;{typed}&quot;
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
