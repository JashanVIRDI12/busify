import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Inputs carry their label as a placeholder throughout this product, so the
 * placeholder is load-bearing text rather than a hint. It stays at 13px and
 * only one step lighter than the value, which is why the box is roomy: 44px
 * gives the placeholder enough air to read as a field name.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-cloud bg-signal-white px-3.5 py-2",
        "text-body-sm text-ink transition-colors outline-none",
        "placeholder:text-ash",
        "hover:border-fog",
        "focus-visible:border-orange-400 focus-visible:outline-none",
        "aria-invalid:border-destructive",
        "disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The two-line field used on the quote builder and every filter bar: a dim
 * label pinned above the value inside a single bordered box.
 */
function StackedInput({
  label,
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  containerClassName?: string;
}) {
  const id = React.useId();

  return (
    <div
      className={cn(
        "flex min-h-[46px] flex-col justify-center rounded-md border border-cloud bg-signal-white px-3 py-1 transition-colors",
        "hover:border-fog focus-within:border-orange-400",
        containerClassName,
      )}
    >
      <label htmlFor={id} className="field-stack-label">
        {label}
      </label>
      <input
        id={id}
        data-slot="stacked-input"
        className={cn(
          "w-full border-0 bg-transparent p-0 text-body-sm font-medium text-ink outline-none",
          "placeholder:font-normal placeholder:text-ash",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export { Input, StackedInput };
