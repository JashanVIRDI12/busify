import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status pills: full radius, small and tight, colour-filled with dark text —
 * the in-product pattern from the reference screenshots.
 *
 * Violet appears here and on the brand mark only.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-[3px] font-sans text-[12px] font-semibold whitespace-nowrap [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-plaster text-carbon",
        secondary: "bg-mercury text-slate",
        brand: "bg-brand/12 text-brand",
        interactive: "bg-interactive/10 text-interactive",
        success: "bg-mint text-[#065f46]",
        emerald: "bg-emerald/12 text-emerald",
        teal: "bg-teal/12 text-teal",
        warning: "bg-amber/18 text-[#8a4b12]",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-bone bg-signal-white text-slate",
        muted: "bg-mist text-ash",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
