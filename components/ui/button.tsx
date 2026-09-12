import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Every button is a full pill. Orange is the only fill, and a surface gets at
 * most one of it: the page's primary action. Everything else that still needs
 * to look clickable takes the orange *outline*, which is why `outline` here is
 * chromatic rather than the usual neutral gray.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
    "font-medium",
    "transition-colors duration-150 outline-none",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-orange-500 text-signal-white shadow-subtle hover:bg-orange-600",
        outline:
          "border border-orange-500 bg-signal-white text-orange-600 hover:bg-orange-50",
        // The one neutral outline, for actions that must not compete.
        quiet:
          "border border-cloud bg-signal-white text-carbon hover:border-fog hover:bg-mist",
        teal: "bg-teal-500 text-signal-white hover:bg-teal-600",
        secondary: "bg-plaster text-ink hover:bg-mercury",
        ghost: "bg-transparent text-slate hover:bg-mist hover:text-ink",
        link: "bg-transparent text-teal-600 underline-offset-4 hover:underline",
        destructive:
          "border border-destructive/40 bg-signal-white text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground",
      },
      size: {
        default: "h-[38px] px-4 text-body-sm",
        sm: "h-8 gap-1 px-3 text-body-sm",
        xs: "h-7 gap-1 px-2.5 text-[12px]",
        lg: "h-11 px-6 text-body",
        icon: "size-[38px]",
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
