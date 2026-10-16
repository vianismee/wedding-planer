import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Disesuaikan dengan DESIGN.md 6: tombol utama ink, radius 12, tinggi 44, bukan pill.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:border disabled:border-[#d9d8e4] disabled:bg-transparent disabled:text-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-[#2e2d40] active:bg-[#0f0e1a]",
        outline: "border border-outline bg-transparent text-ink hover:bg-sunken",
        secondary: "bg-ground text-ink hover:bg-[#e8e7ef]",
        ghost: "bg-transparent text-ink hover:bg-ground",
        destructive: "bg-danger text-white hover:bg-[#9a1d13]",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-[12px]",
        lg: "h-12 px-5 text-[14px]",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
