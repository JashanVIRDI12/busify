import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-lg border px-4 py-3.5 text-body-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-bone bg-signal-white text-ink [&>svg]:text-ash",
        info: "border-interactive/25 bg-interactive/5 text-ink [&>svg]:text-interactive",
        success: "border-emerald/25 bg-emerald/6 text-ink [&>svg]:text-emerald",
        warning: "border-amber/40 bg-amber/10 text-ink [&>svg]:text-amber",
        destructive:
          "border-destructive/25 bg-destructive/6 text-ink [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 font-semibold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-body-sm text-slate", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
