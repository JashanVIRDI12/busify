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
        brand: "bg-orange-100 text-orange-700",
        interactive: "bg-teal-50 text-teal-600",
        success: "bg-teal-100 text-teal-700",
        teal: "bg-teal-50 text-teal-600",
        warning: "bg-orange-100 text-orange-700",
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
