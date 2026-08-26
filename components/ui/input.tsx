import * as React from "react";

import { cn } from "@/lib/utils";

/** Inputs take the 9px radius — the one control that is not a full pill. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-cloud bg-signal-white px-3.5 py-2",
        "font-sans text-body-sm text-ink transition-colors outline-none",
        "placeholder:text-ash",
        "hover:border-fog",
        "focus-visible:border-interactive focus-visible:outline-none",
        "aria-invalid:border-destructive",
        "disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
