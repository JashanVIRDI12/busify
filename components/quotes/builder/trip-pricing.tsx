"use client";

import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toMajor } from "@/lib/pricing";
import { BASE_FARE_BASIS_LABELS } from "@/lib/pricing/quote";
import { cn, formatMoney } from "@/lib/utils";
import { QUOTE_VISIBILITY } from "@/lib/validations/quote-builder";
import type {
  QuoteChargeInput,
  QuoteTripInput,
} from "@/lib/validations/quote-builder";
import type { QuoteBaseFareBasis } from "@/types/database";

import { AddChargeMenu } from "./add-charge-menu";
import { useBuilder } from "./builder-context";
import { NumericInput } from "./numeric-input";

const KIND_OPTIONS: { value: QuoteChargeInput["kind"]; label: string }[] = [
  { value: "FLAT", label: "Flat" },
  { value: "PERCENT", label: "% of fare" },
  { value: "PER_MILE", label: "Per km" },
  { value: "PER_HOUR", label: "Per hour" },
  { value: "PER_DAY", label: "Per day" },
];

const VISIBILITY_LABELS: Record<string, string> = {
  LINE_ITEM_TOTALS: "Line item totals",
  LINE_ITEM_CALCS: "Line item calculations and totals",
  TOTAL_ONLY: "Total charges only",
};

/**
 * One template for the column headings and every row beneath them. The last
 * column is a fixed width rather than `auto`, because an `auto` column that is
 * empty in the heading row and holds the tax box in the rows gives the two
 * grids different `1fr`s, and every heading lands 40px left of its column.
 */
const CHARGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_128px_108px_76px_104px_84px] items-center gap-2";

/** Held to a sensible width inside its own scroller on a phone, never the page. */
function ChargeTable({ children }: { children: React.ReactNode }) {
  return (
    // Padded on every side so focus rings are not clipped by the scroller.
    <div className="-m-1 overflow-x-auto p-1">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

function ChargeHeader({ taxable }: { taxable: boolean }) {
  return (
    <div
      className={cn(
        CHARGE_GRID,
        "pb-1 text-[10px] font-semibold tracking-wide text-ash uppercase",
      )}
    >
      <span>Description</span>
      <span>Type</span>
      <span className="text-right">Rate</span>
      <span className="text-right">Qty</span>
      <span className="text-right">Amount</span>
      <span className="text-right">{taxable ? "Taxable" : ""}</span>
    </div>
  );
}

function ChargeRow({
  trip,
  charge,
  amount,
  currency,
  showTaxable,
}: {
  trip: QuoteTripInput;
  charge: QuoteChargeInput;
  amount: number;
  currency: string;
  showTaxable: boolean;
}) {
  const { setCharge, removeCharge, canEdit } = useBuilder();
  const isPercent = charge.kind === "PERCENT" || charge.section === "TAX";
  const name = charge.label || (charge.section === "TAX" ? "Tax" : "Charge");

  return (
    <div className={cn(CHARGE_GRID, "py-1.5")}>
      <Input
        className="h-8"
        aria-label={charge.section === "TAX" ? "Tax name" : "Charge description"}
        placeholder={charge.section === "TAX" ? "Tax name" : "Description"}
        value={charge.label}
        disabled={!canEdit}
        onChange={(e) => setCharge(trip.id, charge.id, { label: e.target.value })}
      />
      {charge.section === "TAX" ? (
        <span className="px-3 text-[12px] text-ash">Percentage</span>
      ) : (
        <Select
          value={charge.kind}
          onValueChange={(value) =>
            setCharge(trip.id, charge.id, {
              kind: value as QuoteChargeInput["kind"],
            })
          }
          disabled={!canEdit}
        >
          <SelectTrigger size="sm" className="h-8" aria-label={`${name} type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <NumericInput
        className="h-8 text-right"
        aria-label={`${name} rate`}
        prefix={isPercent ? undefined : "$"}
        suffix={isPercent ? "%" : undefined}
        value={charge.rate}
        onValueChange={(value) =>
          setCharge(trip.id, charge.id, { rate: value ?? 0 })
        }
      />
      <NumericInput
        className="h-8 text-right"
        aria-label={`${name} quantity`}
        value={charge.quantity}
        onValueChange={(value) =>
          setCharge(trip.id, charge.id, { quantity: value ?? 1 })
        }
      />
      <span className="tabular text-right text-body-sm font-medium text-ink">
        {formatMoney(amount, currency, { precise: true })}
      </span>
      <div className="flex items-center justify-end gap-1.5">
        {showTaxable && (
          <Checkbox
            checked={charge.taxable}
            disabled={!canEdit}
            aria-label={`Apply taxes to ${name}`}
            onCheckedChange={(checked) =>
              setCharge(trip.id, charge.id, { taxable: checked === true })
            }
          />
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => removeCharge(trip.id, charge.id)}
            className="flex size-7 items-center justify-center rounded-md text-ash transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** The heading every pricing panel opens with, so the four read as one set. */
function PanelHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h3 className="text-body-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-slate" : "text-carbon"}>{label}</dt>
      <dd className={cn("tabular", muted ? "text-slate" : "font-medium text-ink")}>
        {value}
      </dd>
    </div>
  );
}

const plural = (count: number, word: string) =>
  `${count || 0} ${count === 1 ? word : `${word}s`}`;

export function TripPricing({ trip }: { trip: QuoteTripInput }) {
  const { computed, currency, setTrip, addCharge, canEdit, state, setHeader } =
    useBuilder();
  const result = computed.byTrip[trip.id];
  if (!result) return null;

  const money = (minor: number) => formatMoney(toMajor(minor), currency, { precise: true });
  const chargeAmount = (chargeId: string) => {
    const index = trip.charges.findIndex((c) => c.id === chargeId);
    return toMajor(result.charges[index]?.amount ?? 0);
  };

  const manual = result.baseFareOverridden;

  const baseFareCharges = trip.charges.filter((c) => c.section === "BASE_FARE");
  const itemized = trip.charges.filter((c) => c.section === "ITEMIZED");
  const taxes = trip.charges.filter((c) => c.section === "TAX");
  const itemizedTotal = result.itemizedCharges.reduce(
    (sum, charge) => sum + charge.amount,
    0,
  );

  const candidates: { basis: QuoteBaseFareBasis; amount: number }[] = [
    { basis: "DAILY", amount: result.candidates.daily },
    { basis: "HOURLY", amount: result.candidates.hourly },
    { basis: "MILEAGE", amount: result.candidates.mileage },
    { basis: "BASE", amount: result.candidates.base },
  ];

  const rateFor: Record<QuoteBaseFareBasis, keyof QuoteTripInput> = {
    DAILY: "rate_daily",
    HOURLY: "rate_hourly",
    MILEAGE: "rate_per_mile",
    BASE: "rate_flat_base",
  };

  /** What the rate is per, beside the number, so "3.1" reads as a price. */
  const perFor: Record<QuoteBaseFareBasis, string | undefined> = {
    DAILY: "/day",
    HOURLY: "/h",
    MILEAGE: "/km",
    BASE: undefined,
  };

  const unitFor: Record<QuoteBaseFareBasis, string> = {
    DAILY: `× ${plural(trip.days, "day")}`,
    HOURLY: `× ${trip.hours || 0} h`,
    MILEAGE: `× ${trip.total_miles || 0} km`,
    BASE: "Flat amount",
  };

  const modeNote = manual
    ? "Using the amount you typed"
    : trip.base_fare_mode === "HIGHEST"
      ? "Using whichever rate comes out highest"
      : "Using the rate you picked";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="min-w-0 space-y-5">
        {/*
          These three drive the daily, hourly and mileage candidates below.
          The itinerary works all of them out — days from the dates, hours from
          drive time plus waiting, distance from the measured route — so they
          are shown here to be checked and overridden, not filled in.
        */}
        <div>
          <p className="mb-2 text-[12px] text-ash">
            Taken from the itinerary. Type over any of them to price this trip
            differently.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[12px] font-medium text-slate">Days</span>
              <NumericInput
                value={trip.days}
                onValueChange={(v) => setTrip(trip.id, { days: v ?? 0 })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[12px] font-medium text-slate">Hours</span>
              <NumericInput
                suffix="h"
                value={trip.hours}
                onValueChange={(v) => setTrip(trip.id, { hours: v ?? 0 })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[12px] font-medium text-slate">Total distance</span>
              <NumericInput
                suffix="km"
                value={trip.total_miles}
                onValueChange={(v) => setTrip(trip.id, { total_miles: v ?? 0 })}
              />
            </label>
          </div>
        </div>

        {/* Base Fare */}
        <section className="rounded-xl border border-bone p-4">
          <PanelHeading title="Base Fare">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[12px] text-ash" aria-live="polite">
                {modeNote}
              </span>
              <div
                role="radiogroup"
                aria-label="How the base fare is chosen"
                className="inline-flex rounded-full bg-plaster p-0.5 text-[12px] font-semibold"
              >
                {(["HIGHEST", "CHOOSE"] as const).map((mode) => {
                  const on = !manual && trip.base_fare_mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!canEdit}
                      onClick={() =>
                        setTrip(trip.id, { base_fare_mode: mode, base_fare_override: null })
                      }
                      className={cn(
                        "rounded-full px-3 py-1 transition-colors disabled:cursor-default",
                        on
                          ? "bg-signal-white text-ink shadow-subtle"
                          : "text-slate enabled:hover:text-ink",
                      )}
                    >
                      {mode === "HIGHEST" ? "Highest" : "Choose"}
                    </button>
                  );
                })}
              </div>
            </div>
          </PanelHeading>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {candidates.map(({ basis, amount }) => {
              const selected = !manual && result.selectedBasis === basis;
              const rateKey = rateFor[basis];
              return (
                <div
                  key={basis}
                  className={cn(
                    "flex flex-col rounded-lg border p-2.5 transition-colors",
                    selected ? "border-teal-400 bg-teal-50" : "border-bone",
                  )}
                >
                  {/* Picking a card is the choice itself: it switches the fare
                      to Choose rather than asking for that first. */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={selected}
                    onClick={() =>
                      setTrip(trip.id, {
                        base_fare_basis: basis,
                        base_fare_mode: "CHOOSE",
                        base_fare_override: null,
                      })
                    }
                    className="-m-1 block rounded-md p-1 text-left transition-colors enabled:hover:bg-mist/70 disabled:cursor-default"
                  >
                    <span className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate">
                      {BASE_FARE_BASIS_LABELS[basis]}
                      {selected && (
                        <span className="inline-flex items-center gap-0.5 text-teal-600">
                          <Check className="size-3" aria-hidden />
                          Used
                        </span>
                      )}
                    </span>
                    <span className="tabular mt-0.5 block text-body font-semibold text-ink">
                      {money(amount)}
                    </span>
                  </button>
                  <NumericInput
                    className="mt-2 h-8 w-full"
                    aria-label={`${BASE_FARE_BASIS_LABELS[basis]} rate`}
                    prefix="$"
                    suffix={perFor[basis]}
                    value={trip[rateKey] as number}
                    onValueChange={(value) =>
                      setTrip(trip.id, { [rateKey]: value ?? 0 })
                    }
                  />
                  <span className="tabular mt-1 block text-[11px] text-ash">
                    {unitFor[basis]}
                  </span>
                </div>
              );
            })}

            {/*
              Manual: the operator types the base fare outright. Stored as
              base_fare_override, which the engine uses in place of whichever
              candidate would otherwise win; clearing it hands back to the calc.
            */}
            <div
              className={cn(
                "flex flex-col rounded-lg border p-2.5 transition-colors",
                manual ? "border-teal-400 bg-teal-50" : "border-dashed border-cloud",
              )}
            >
              <button
                type="button"
                disabled={!canEdit || manual}
                aria-pressed={manual}
                onClick={() =>
                  setTrip(trip.id, { base_fare_override: toMajor(result.baseFare) })
                }
                className="-m-1 block rounded-md p-1 text-left transition-colors enabled:hover:bg-mist/70 disabled:cursor-default"
              >
                <span className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate">
                  Manual
                  {manual && (
                    <span className="inline-flex items-center gap-0.5 text-teal-600">
                      <Check className="size-3" aria-hidden />
                      Used
                    </span>
                  )}
                </span>
                <span className="tabular mt-0.5 block text-body font-semibold text-ink">
                  {manual ? money(result.baseFare) : "—"}
                </span>
              </button>
              <NumericInput
                className="mt-2 h-8 w-full"
                aria-label="Manual base fare"
                prefix="$"
                nullable
                placeholder="Enter rate"
                value={trip.base_fare_override}
                onValueChange={(value) =>
                  setTrip(trip.id, { base_fare_override: value })
                }
              />
              <span className="mt-1 flex items-center justify-between gap-1 text-[11px] text-ash">
                {manual ? "Overrides the rates" : "Your own amount"}
                {manual && canEdit && (
                  <button
                    type="button"
                    onClick={() => setTrip(trip.id, { base_fare_override: null })}
                    className="inline-flex items-center gap-0.5 rounded px-1 font-medium text-teal-600 transition-colors hover:bg-teal-100/60 hover:text-teal-700"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    Use calc
                  </button>
                )}
              </span>
            </div>
          </div>

          {/* Base fare charges */}
          <div className="mt-4">
            {baseFareCharges.length > 0 && (
              <ChargeTable>
                <ChargeHeader taxable={false} />
                {baseFareCharges.map((charge) => (
                  <ChargeRow
                    key={charge.id}
                    trip={trip}
                    charge={charge}
                    amount={chargeAmount(charge.id)}
                    currency={currency}
                    showTaxable={false}
                  />
                ))}
              </ChargeTable>
            )}
            <div className={baseFareCharges.length > 0 ? "mt-2" : undefined}>
              <AddChargeMenu
                tripId={trip.id}
                section="BASE_FARE"
                label="Add base fare charge"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-bone pt-3">
            <span className="text-body-sm font-semibold text-ink">Total Base Fare</span>
            <span className="tabular text-body-sm font-semibold text-ink">
              {money(result.baseFareTotal)}
            </span>
          </div>
        </section>

        {/* Itemized charges */}
        <section className="rounded-xl border border-bone p-4">
          <PanelHeading title="Charges" />
          {itemized.length > 0 ? (
            <ChargeTable>
              <ChargeHeader taxable />
              {itemized.map((charge) => (
                <ChargeRow
                  key={charge.id}
                  trip={trip}
                  charge={charge}
                  amount={chargeAmount(charge.id)}
                  currency={currency}
                  showTaxable
                />
              ))}
            </ChargeTable>
          ) : (
            <p className="text-[12.5px] text-ash">
              Anything on top of the base fare — a fuel surcharge, parking, a
              driver&apos;s hotel.
            </p>
          )}
          <div className="mt-2">
            <AddChargeMenu tripId={trip.id} section="ITEMIZED" label="Add charge" />
          </div>
        </section>

        {/* Taxes */}
        <section className="rounded-xl border border-bone p-4">
          <PanelHeading title="Taxes" />
          {taxes.length > 0 ? (
            <ChargeTable>
              <ChargeHeader taxable={false} />
              {taxes.map((charge) => (
                <ChargeRow
                  key={charge.id}
                  trip={trip}
                  charge={charge}
                  amount={chargeAmount(charge.id)}
                  currency={currency}
                  showTaxable={false}
                />
              ))}
            </ChargeTable>
          ) : (
            <p className="text-[12.5px] text-ash">No taxes on this trip.</p>
          )}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => addCharge(trip.id, "TAX")}
            className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-body-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add tax
          </button>
        </section>
      </div>

      {/* The summary stays in view while the charges scroll past it, so the
          number every change moves is never out of sight. */}
      <aside className="space-y-4 lg:sticky lg:top-[4.5rem]">
        <section
          aria-labelledby={`price-summary-${trip.id}`}
          className="rounded-xl border border-bone bg-mist p-5"
        >
          <h3
            id={`price-summary-${trip.id}`}
            className="text-body-sm font-semibold text-ink"
          >
            Price Summary
          </h3>
          <dl className="mt-3 space-y-2 text-body-sm">
            <SummaryRow label="Base fare" value={money(result.baseFareTotal)} />
            <SummaryRow label="Charges" value={money(itemizedTotal)} />
            <div className="border-t border-bone pt-2">
              <SummaryRow label="Subtotal" value={money(result.subtotal)} />
            </div>
            <SummaryRow label="Taxes" value={money(result.taxTotal)} />
          </dl>
          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-cloud pt-4">
            <span className="text-body font-semibold text-ink">Trip Total</span>
            <span className="tabular text-subheading font-semibold text-ink">
              {money(result.total)}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5 text-body-sm">
            <SummaryRow label="Due on booking" value={money(result.dueNow)} muted />
            <SummaryRow label="Due later" value={money(result.dueLater)} muted />
          </dl>
        </section>

        <section className="rounded-xl border border-bone p-5">
          <h3 id={`visibility-${trip.id}`} className="text-body-sm font-semibold text-ink">
            Choose What Customers Will See
          </h3>
          <p className="mt-0.5 text-[12px] text-ash">Applies to every trip on this quote.</p>
          <div
            role="radiogroup"
            aria-labelledby={`visibility-${trip.id}`}
            className="mt-3 space-y-2.5"
          >
            {QUOTE_VISIBILITY.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-2.5 text-body-sm has-disabled:cursor-default"
              >
                <input
                  type="radio"
                  name={`visibility-${trip.id}`}
                  className="mt-[3px] size-3.5 accent-orange-500"
                  checked={state.header.customer_visibility === value}
                  disabled={!canEdit}
                  onChange={() =>
                    setHeader({
                      customer_visibility:
                        value as typeof state.header.customer_visibility,
                    })
                  }
                />
                <span
                  className={
                    state.header.customer_visibility === value
                      ? "font-medium text-ink"
                      : "text-slate"
                  }
                >
                  {VISIBILITY_LABELS[value]}
                </span>
              </label>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
