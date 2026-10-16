"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "@/components/ui/cromia-color-picker";
import { cx } from "./kit";

// Gaya mengikuti CromiaColorPicker dari 21st.dev, tanpa kanal alpha:
// warna palet disimpan sebagai hex 6 digit, jadi transparansi tidak dipakai.
const THUMB = "size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.14)] bg-[var(--color-picker-thumb-color)]";
const SWATCH =
  "size-7 cursor-pointer rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-opacity hover:opacity-80 data-[selected]:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_0_0_2px_var(--background),0_0_0_3px_var(--foreground)]";
const CHANNELS = [
  ["hue", "H"],
  ["saturation", "S"],
  ["brightness", "B"],
] as const;

const toHex6 = (c: string) => c.slice(0, 7).toLowerCase();

/**
 * Pemilih warna terkontrol: tombol berisi contoh warna dan kode hex, membuka popover Cromia.
 * `swatches` adalah warna cepat (misalnya warna lain yang sudah dipakai di papan).
 */
export function ColorField({
  value,
  onChange,
  label,
  swatches = [],
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  swatches?: string[];
}) {
  const quick = [...new Set(swatches.map(toHex6))].filter((s) => s !== toHex6(value)).slice(0, 10);
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${label}, ${value.toUpperCase()}. Ubah warna`}
        className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-outline bg-ground px-2.5 text-left hover:border-[#9c9bae] data-[state=open]:border-ink"
      >
        <span className="size-7 shrink-0 rounded-md border border-ink/10" style={{ background: value }} aria-hidden="true" />
        <span className="text-[13px] font-semibold uppercase tabular">{value}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-4">
        <ColorPicker.Root color={value} onColorChange={(hex: string) => onChange(toHex6(hex))}>
          <ColorPicker.Area className="relative h-44 w-full cursor-crosshair" aria-label="Saturasi dan kecerahan">
            <ColorPicker.AreaBackground className="overflow-hidden rounded-lg" />
            <ColorPicker.AreaThumb className={THUMB} aria-label="Saturasi dan kecerahan" />
          </ColorPicker.Area>
          <ColorPicker.ChannelSlider channel="hue" className="relative mt-4 h-3 w-full">
            <ColorPicker.ChannelSliderTrack className="h-full w-full rounded-full" />
            <ColorPicker.ChannelSliderThumb className={THUMB} aria-label="Rona warna" />
          </ColorPicker.ChannelSlider>
          <label className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="size-5 shrink-0 rounded-md border border-black/10" style={{ backgroundColor: value }} aria-hidden="true" />
            <span className="sr-only">Kode hex</span>
            <ColorPicker.Input channel="hex" className="w-full bg-transparent text-sm font-semibold uppercase tabular text-foreground outline-none data-invalid:text-destructive" />
          </label>
          {quick.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted">Warna di papan ini</span>
              <ColorPicker.SwatchGroup className="flex flex-wrap gap-2" aria-label="Warna di papan ini">
                {quick.map((s) => (
                  <ColorPicker.Swatch key={s} value={s} selected={false} onSelect={(hex: string) => onChange(toHex6(hex))} className={cx(SWATCH, "hit-44")} />
                ))}
              </ColorPicker.SwatchGroup>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CHANNELS.map(([channel, short]) => (
              <label key={channel} className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5">
                <span className="text-[11px] font-semibold text-muted" aria-hidden="true">
                  {short}
                </span>
                <span className="sr-only">{{ hue: "Rona", saturation: "Saturasi", brightness: "Kecerahan" }[channel]}</span>
                <ColorPicker.Input channel={channel} className="min-w-0 flex-1 bg-transparent text-right text-xs tabular text-foreground outline-none" />
              </label>
            ))}
          </div>
        </ColorPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
