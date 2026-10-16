import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Varian mengikuti semantik status DESIGN.md: warn (perlu tindakan), ok, info, note (catatan sistem).
const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-[14px] px-3.5 py-2.5 text-left text-[13px] leading-[1.5] has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        warn: "bg-warn-bg text-warn-fg",
        ok: "bg-ok-bg text-ok-fg",
        info: "bg-info-bg text-info-fg",
        note: "bg-note-bg text-note-fg",
        destructive: "bg-[#fdf1ef] text-danger",
      },
    },
    defaultVariants: { variant: "warn" },
  }
)

function Alert({ className, variant, role, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={role ?? (variant === "ok" || variant === "info" ? "status" : "alert")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-bold group-has-[>svg]:col-start-2", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_p:not(:last-child)]:mb-1", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
