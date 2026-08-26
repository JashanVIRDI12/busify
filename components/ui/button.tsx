import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Every button is a full pill. That single relentless radius is the system's
 * most consistent geometric choice, so nothing here ever gets a smaller corner.
 *
 * The filled variant is near-black (#202020), never the brand violet — violet
 * is identity only, and promoting it to a CTA is explicitly out of bounds.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "font-display font-bold tracking-[-0.01em]",
    "transition-colors duration-150 outline-none",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-ink text-signal-white hover:bg-carbon",
        // Neutral outline — the structural default at 1px #e8e8e8.
        outline:
          "border border-bone bg-signal-white text-ink hover:bg-mist hover:border-cloud",
        // Chromatic outline: blue signals interactive, without filling.
        interactive:
          "border border-interactive bg-signal-white text-interactive hover:bg-interactive/6",
        secondary: "bg-plaster text-ink hover:bg-mercury",
        ghost: "bg-transparent text-carbon hover:bg-ink/4",
        link: "bg-transparent text-interactive underline-offset-4 hover:underline",
        destructive:
          "border border-destructive/35 bg-signal-white text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
      },
      size: {
        default: "h-10 px-6 text-body-sm",
        sm: "h-8 gap-1.5 px-4 text-body-sm",
        lg: "h-12 px-8 text-body",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
