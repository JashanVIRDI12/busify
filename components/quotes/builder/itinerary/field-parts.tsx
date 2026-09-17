"use client";

import { CalendarDays, Clock, Plus, RotateCcw } from "lucide-react";

import { StackedInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The small presentational pieces the itinerary rows are built from.
 *
 * They live together because they only make sense together: every one of them
 * exists to keep a stop row to a single line of fields with the optional parts
 * folded away, which is the whole point of the layout.
 */

/**
 * Reveals an optional field.
 *
 * Every field shown by default is a question being asked of an operator who is
 * usually on the phone. Spot times, wait times and notes matter on perhaps one
 * trip in five, so they start folded and cost one click when they are wanted.
 */
export function DisclosureButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-teal-600",
        "transition-colors hover:bg-teal-50 hover:text-teal-700",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500",
        className,
      )}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Marks a value the builder worked out rather than one the operator typed.
 *
 * Without it an auto-filled arrival time is indistinguishable from a promise
 * somebody made to a customer, and an operator who cannot tell the difference
 * has to re-check every field — which costs more than the filling saved.
 */
export function AutoTag() {
  return (
    <span
      className="rounded-sm bg-teal-50 px-1 py-px text-[9px] font-semibold tracking-wide text-teal-700 uppercase"
      title="Calculated from the measured route. Type here to override it."
    >
      auto
      <span className="sr-only"> — calculated, editable</span>
    </span>
  );
}

/** Clears an override so the value goes back to being derived. */
export function RevertButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "shrink-0 rounded-md p-1.5 text-ash transition-colors",
        "hover:bg-mist hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500",
      )}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/**
 * A field-shaped box holding a value nobody types.
 *
 * The role of a stop is decided by where it sits: the first one is the pickup,
 * the last is the dropoff, and dragging a stop to the top makes it the pickup
 * whatever it used to be. Rendering that as an editable box would invite an
 * operator to write "Dropoff" in the first row and expect the trip to reverse.
 *
 * Not a disabled `<input>` — a disabled input is still a form control that a
 * screen reader will announce and a keyboard will skip past for no reason. It
 * is text, so it is rendered as text, and hidden from assistive tech because
 * the row's own heading already says the same word.
 */
export function LockedField({ value }: { value: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[46px] items-center rounded-md border border-bone bg-mist px-3.5 text-body-sm text-ash select-none"
    >
      {value}
    </div>
  );
}

/** A date box with the calendar affordance the rest of the product uses. */
export function DateField({
  label = "Date",
  value,
  disabled,
  auto,
  onChange,
  className,
}: {
  label?: string;
  value: string | null;
  disabled?: boolean;
  auto?: boolean;
  onChange: (value: string | null) => void;
  className?: string;
}) {
  return (
    <StackedInput
      type="date"
      icon={<CalendarDays />}
      containerClassName={className}
      label={
        <>
          {label}
          {auto ? <AutoTag /> : null}
        </>
      }
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}

/** A time box. `label` carries the meaning: Depart, Arrive, Spot. */
export function TimeField({
  label,
  value,
  disabled,
  auto,
  onChange,
  className,
}: {
  label: string;
  value: string | null;
  disabled?: boolean;
  auto?: boolean;
  onChange: (value: string | null) => void;
  className?: string;
}) {
  return (
    <StackedInput
      type="time"
      icon={<Clock />}
      containerClassName={className}
      label={
        <>
          {label}
          {auto ? <AutoTag /> : null}
        </>
      }
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}

function duration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  return `${Math.floor(whole / 60)}h ${whole % 60}m`;
}

/**
 * The drive from the previous stop, and the running total to here.
 *
 * Sitting above the date and time it reads as the reason those values are what
 * they are: the leg is what pushed this arrival to when it is.
 */
export function LegPill({
  fromLabel,
  toLabel,
  minutes,
  miles,
  totalMinutes,
  totalMiles,
  measuring,
}: {
  fromLabel: string;
  toLabel: string;
  minutes: number;
  miles: number;
  totalMinutes: number;
  totalMiles: number;
  measuring?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-bone bg-signal-white/70 px-3 py-1.5",
        "text-[11px] text-slate transition-opacity",
        measuring && "opacity-60",
      )}
    >
      <span>
        {fromLabel} → {toLabel}:{" "}
        <span className="font-semibold text-ink">
          {duration(minutes)} · {miles.toFixed(1)} km
        </span>
      </span>
      <span className="text-ash">
        Total:{" "}
        <span className="font-semibold text-slate">
          {duration(totalMinutes)} · {totalMiles.toFixed(1)} km
        </span>
      </span>
    </div>
  );
}
