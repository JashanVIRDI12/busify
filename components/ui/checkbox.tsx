"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Selection checkboxes are square with a small radius — deliberately the one
 * control in the system that is not a pill, so a selected row reads as a
 * different kind of state from a filter chip.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[16px] shrink-0 rounded-[4px] border border-cloud bg-signal-white",
        "transition-colors outline-none hover:border-orange-300",
        "data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500",
        "data-[state=indeterminate]:border-orange-500 data-[state=indeterminate]:bg-orange-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-signal-white">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3 stroke-[3]" />
        ) : (
          <Check className="size-3 stroke-[3]" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
