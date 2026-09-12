"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumericInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Keep null when cleared instead of coercing to 0. */
  nullable?: boolean;
  prefix?: string;
  suffix?: string;
};

/**
 * A number field the operator can actually type in: it holds a string while
 * focused (so "1." and "" are allowed mid-edit) and commits a number out.
 */
export function NumericInput({
  value,
  onValueChange,
  nullable = false,
  prefix,
  suffix,
  className,
  onBlur,
  onFocus,
  ...props
}: NumericInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);

  const display =
    draft ?? (value === null || Number.isNaN(value) ? "" : String(value));

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onValueChange(nullable ? null : 0);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) onValueChange(parsed);
  };

  const field = (
    <Input
      {...props}
      inputMode="decimal"
      value={display}
      onFocus={(event) => {
        setDraft(display);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (/^-?\d*\.?\d*$/.test(next)) {
          setDraft(next);
          commit(next);
        }
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
      className={cn(prefix && "pl-7", suffix && "pr-9", className)}
    />
  );

  if (!prefix && !suffix) return field;

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-ash">
          {prefix}
        </span>
      )}
      {field}
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-ash">
          {suffix}
        </span>
      )}
    </div>
  );
}
