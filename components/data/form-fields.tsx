"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Drawer forms label their fields with the placeholder rather than a floating
 * label above the box. That is only legible because the field is 44px tall and
 * the placeholder sits at full body size — so these wrappers own the height and
 * the error slot, and callers never restyle the control itself.
 */

export type FieldErrors = Record<string, string[]> | undefined;

function ErrorText({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1 text-[12px] text-destructive" role="alert">
      {messages[0]}
    </p>
  );
}

export function TextField({
  name,
  placeholder,
  errors,
  className,
  ...props
}: React.ComponentProps<"input"> & { name: string; errors?: FieldErrors }) {
  const messages = errors?.[name];

  return (
    <div className={className}>
      <input
        name={name}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-invalid={messages ? true : undefined}
        className={cn(
          "h-11 w-full rounded-md border border-cloud bg-signal-white px-3.5 text-body-sm text-ink transition-colors outline-none",
          "placeholder:text-ash hover:border-fog focus-visible:border-orange-400",
          "aria-invalid:border-destructive",
          "disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-60",
        )}
        {...props}
      />
      <ErrorText messages={messages} />
    </div>
  );
}

export function TextAreaField({
  name,
  placeholder,
  errors,
  className,
  rows = 4,
  ...props
}: React.ComponentProps<"textarea"> & { name: string; errors?: FieldErrors }) {
  const messages = errors?.[name];

  return (
    <div className={className}>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-invalid={messages ? true : undefined}
        className={cn(
          "w-full rounded-md border border-cloud bg-signal-white px-3.5 py-2.5 text-body-sm text-ink transition-colors outline-none",
          "placeholder:text-ash hover:border-fog focus-visible:border-orange-400",
          "aria-invalid:border-destructive",
        )}
        {...props}
      />
      <ErrorText messages={messages} />
    </div>
  );
}

export function SelectField({
  name,
  placeholder,
  options,
  defaultValue,
  errors,
  className,
  disabled,
}: {
  name: string;
  placeholder: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  errors?: FieldErrors;
  className?: string;
  disabled?: boolean;
}) {
  const messages = errors?.[name];

  return (
    <div className={className}>
      <Select name={name} defaultValue={defaultValue} disabled={disabled}>
        <SelectTrigger
          aria-label={placeholder}
          aria-invalid={messages ? true : undefined}
          className="h-11 data-[size=default]:h-11"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ErrorText messages={messages} />
    </div>
  );
}

/**
 * Phone with a leading country code and a trailing extension.
 *
 * The country box is a real select, not the fixed "US" label of the product we
 * are matching: this is a Canadian-first console, and an operator whose whole
 * contact list is +1 still needs the box to say the right thing.
 */
export function PhoneField({
  name,
  extensionName,
  defaultCountry = "CA",
  defaultValue,
  defaultExtension,
  errors,
}: {
  name: string;
  extensionName?: string;
  defaultCountry?: string;
  defaultValue?: string;
  defaultExtension?: string;
  errors?: FieldErrors;
}) {
  const messages = errors?.[name];

  return (
    <div>
      <div className="flex gap-3.5">
        <div className="flex h-11 flex-1 items-stretch overflow-hidden rounded-md border border-cloud bg-signal-white transition-colors focus-within:border-orange-400 hover:border-fog">
          <label className="relative flex items-center gap-1 border-r border-bone bg-mist px-2.5 text-[12px] font-medium text-carbon">
            <select
              name={`${name}_country`}
              defaultValue={defaultCountry}
              aria-label="Country code"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="CA">CA</option>
              <option value="US">US</option>
            </select>
            <span aria-hidden>{defaultCountry}</span>
            <ChevronDown className="size-3 text-ash" aria-hidden />
          </label>
          <input
            name={name}
            type="tel"
            defaultValue={defaultValue}
            placeholder="Phone"
            aria-label="Phone"
            className="min-w-0 flex-1 bg-transparent px-3 text-body-sm text-ink outline-none placeholder:text-ash"
          />
        </div>

        {extensionName && (
          <input
            name={extensionName}
            defaultValue={defaultExtension}
            placeholder="Extension"
            aria-label="Extension"
            className="h-11 w-[7.5rem] rounded-md border border-cloud bg-signal-white px-3.5 text-body-sm text-ink transition-colors outline-none placeholder:text-ash hover:border-fog focus-visible:border-orange-400"
          />
        )}
      </div>
      <ErrorText messages={messages} />
    </div>
  );
}

/** Teal switch with its explanation to the right, as used across the builder. */
export function ToggleField({
  name,
  label,
  defaultChecked,
  description,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  description?: string;
  disabled?: boolean;
}) {
  const [checked, setChecked] = React.useState(defaultChecked ?? false);

  return (
    <div className="flex items-start gap-3">
      {/* The switch is not a form control, so a hidden input carries the value. */}
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Switch
        checked={checked}
        onCheckedChange={setChecked}
        disabled={disabled}
        aria-label={label}
        className="mt-0.5 data-[state=checked]:bg-teal-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body-sm text-carbon">{label}</span>
        {description && (
          <span className="text-[12px] text-ash">{description}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Repeatable free-text tags, submitted as one hidden input per value so the
 * server reads them with `formData.getAll(name)` and never has to guess at a
 * separator that a tag might itself contain.
 */
export function TagsField({
  name,
  label,
  defaultValue = [],
  placeholder = "Add and press Enter",
  max = 20,
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  placeholder?: string;
  max?: number;
}) {
  const [tags, setTags] = React.useState<string[]>(defaultValue);
  const [draft, setDraft] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  function commit() {
    const value = draft.trim();
    if (value && !tags.includes(value) && tags.length < max) {
      setTags([...tags, value]);
    }
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <React.Fragment key={tag}>
          <input type="hidden" name={name} value={tag} />
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-medium text-teal-700">
            {tag}
            <button
              type="button"
              onClick={() => setTags(tags.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
              className="text-teal-600/70 transition-colors hover:text-teal-700"
            >
              &times;
            </button>
          </span>
        </React.Fragment>
      ))}

      <span className="text-body-sm text-carbon">{label}:</span>

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          className="h-8 w-44 rounded-md border border-cloud px-2.5 text-body-sm text-ink outline-none focus-visible:border-orange-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={tags.length >= max}
          className="text-[12.5px] font-medium text-teal-600 transition-colors hover:text-teal-700 disabled:opacity-50"
        >
          + Add
        </button>
      )}
    </div>
  );
}

/** A section label inside a drawer or a builder panel. */
export function FieldGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-body-sm font-semibold text-ink">{children}</p>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
    >
      {message}
    </p>
  );
}
