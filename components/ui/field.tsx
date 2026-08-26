import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FieldProps = React.ComponentProps<"div"> & {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
};

function Field({
  label,
  htmlFor,
  hint,
  errors,
  required,
  className,
  children,
  ...props
}: FieldProps) {
  const error = errors?.[0];

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-[12px] leading-relaxed text-ash">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          className="text-[12px] font-medium leading-relaxed text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export { Field };
