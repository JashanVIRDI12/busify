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
 *
 * An `icon` sits outside that stack rather than inside the input, so a date and
 * a time field line their values up with each other even though one of them is
 * wider. The label accepts nodes, not just text, which is what lets a field say
 * how its value was arrived at without a second row.
 */
function StackedInput({
  label,
  icon,
  className,
  containerClassName,
  ...props
}: Omit<React.ComponentProps<"input">, "children"> & {
  label: React.ReactNode;
  /** Sits left of the stack, e.g. a calendar on a date field. */
  icon?: React.ReactNode;
  containerClassName?: string;
}) {
  const id = React.useId();

  return (
    <div
      className={cn(
        "flex min-h-[46px] items-center gap-2.5 rounded-md border border-cloud bg-signal-white px-3 py-1 transition-colors",
        "hover:border-fog focus-within:border-orange-400",
        "has-disabled:bg-mist has-disabled:opacity-70",
        containerClassName,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-ash [&_svg]:size-4 [&_svg]:shrink-0"
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <label htmlFor={id} className="field-stack-label flex items-center gap-1.5">
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
      </span>
    </div>
  );
}

export { Input, StackedInput };
