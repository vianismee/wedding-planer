// Dari 21st.dev (ravikatiyar162/color-palette-card, BrandingCard).
// Perubahan lokal: prop opsional `animated` (default true, perilaku asli) dan `categoryClassName`,
// supaya kartu bisa dipakai di kanvas Moodboard tanpa animasi masuk dan efek melayang saat hover.
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BrandingCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  /** The main category label displayed at the top. */
  category: string;
  /** The primary title for the branding element. */
  title: string;
  /** The subtitle or specific name (e.g., font name). */
  subtitle: string;
  /** The visual element to display, typically text or an icon. */
  displayElement: React.ReactNode;
  /** An array of color strings (e.g., hex, rgb) for the palette. */
  colors: string[];
  /** Animasi masuk dan hover. Default true seperti komponen aslinya. */
  animated?: boolean;
  /** Kelas tambahan untuk label kategori. */
  categoryClassName?: string;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const swatchVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

const BrandingCard = React.forwardRef<HTMLDivElement, BrandingCardProps>(
  ({ className, category, title, subtitle, displayElement, colors, animated = true, categoryClassName, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg",
          className,
        )}
        variants={animated ? cardVariants : undefined}
        initial={animated ? "hidden" : false}
        animate={animated ? "visible" : undefined}
        whileHover={animated ? { y: -5, transition: { duration: 0.2 } } : undefined}
        aria-label={`${category}: ${title}`}
        role="group"
        {...props}
      >
        {/* Main content area */}
        <div className="p-6">
          <p className={cn("mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground", categoryClassName)}>{category}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold tracking-tight">{title}</h3>
              <p className="truncate text-lg text-muted-foreground">{subtitle}</p>
            </div>
            <div className="shrink-0 text-5xl font-bold tracking-tighter">{displayElement}</div>
          </div>
        </div>

        {/* Color palette section */}
        <div className="flex h-24 w-full">
          {colors.map((color, index) => (
            <motion.div
              key={index}
              className="h-full flex-1"
              style={{ backgroundColor: color }}
              variants={animated ? swatchVariants : undefined}
              aria-label={`Color swatch ${index + 1}: ${color}`}
            />
          ))}
        </div>
      </motion.div>
    );
  },
);

BrandingCard.displayName = "BrandingCard";

export { BrandingCard };
