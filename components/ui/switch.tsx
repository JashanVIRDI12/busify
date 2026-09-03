"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5",
        "transition-colors outline-none",
        "data-[state=unchecked]:bg-cloud data-[state=checked]:bg-interactive",
        "focus-visible:ring-2 focus-visible:ring-interactive/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-signal-white shadow-sm transition-transform",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
