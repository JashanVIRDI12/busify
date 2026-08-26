import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-cloud bg-signal-white px-3.5 py-2.5",
        "field-sizing-content font-sans text-body-sm text-ink transition-colors outline-none",
        "placeholder:text-ash",
        "hover:border-fog focus-visible:border-interactive",
        "aria-invalid:border-destructive",
        "disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
