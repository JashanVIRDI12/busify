"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A pair (or few) of mutually exclusive options, shown side by side rather than
 * in a dropdown.
 *
 * Used where both choices need to be readable at rest — "Hourly or Percentage",
 * "Daily rate or Hours per trip". A select would hide the alternative behind a
 * click, and these settings are read far more often than they are changed.
 *
 * Submits through a hidden input, so it behaves like any other form field.
 */
export function Segmented({
  name,
  options,
  defaultValue,
  onChange,
  className,
  size = "default",
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: "default" | "sm";
}) {
  const [value, setValue] = React.useState(
    defaultValue ?? options[0]?.value ?? "",
  );

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="radiogroup"
    >
      <input type="hidden" name={name} value={value} />

      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setValue(option.value);
              onChange?.(option.value);
            }}
            className={cn(
              "rounded-full border transition-colors",
              size === "sm"
                ? "px-3 py-1 text-[12px]"
                : "px-4 py-1.5 text-body-sm",
              active
                ? "border-orange-400 bg-signal-white font-medium text-orange-600"
                : "border-transparent text-slate hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A labelled row in a settings panel: explanation on the left, controls on the
 * right. The left column is fixed-width so a column of them lines up.
 */
export function SettingRow({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-t border-bone py-5 md:flex-row md:gap-8",
        className,
      )}
    >
      <div className="md:w-[19rem] md:shrink-0">
        <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
          {icon}
          {title}
        </p>
        {description && (
          <p className="mt-1 text-[12.5px] leading-snug text-slate">
            {description}
          </p>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}
