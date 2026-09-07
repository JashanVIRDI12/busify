"use client";

import { RotateCcw, Trash2 } from "lucide-react";

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
import { formatMoney } from "@/lib/utils";
import { QUOTE_VISIBILITY } from "@/lib/validations/quote-builder";
import type {
  QuoteChargeInput,
  QuoteTripInput,
} from "@/lib/validations/quote-builder";
import type { QuoteBaseFareBasis } from "@/types/database";

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

  return (
    <div className="grid grid-cols-[1fr_120px_100px_80px_90px_auto] items-center gap-2 py-1.5">
      <Input
        className="h-8"
        placeholder={charge.section === "TAX" ? "Tax name" : "Description"}
        value={charge.label}
        disabled={!canEdit}
        onChange={(e) => setCharge(trip.id, charge.id, { label: e.target.value })}
      />
      {charge.section === "TAX" ? (
        <span className="text-center text-[12px] text-ash">Percentage</span>
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
          <SelectTrigger size="sm" className="h-8">
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
        suffix={charge.kind === "PERCENT" || charge.section === "TAX" ? "%" : undefined}
        value={charge.rate}
        onValueChange={(value) =>
          setCharge(trip.id, charge.id, { rate: value ?? 0 })
        }
      />
      <NumericInput
        className="h-8 text-right"
        value={charge.quantity}
        onValueChange={(value) =>
          setCharge(trip.id, charge.id, { quantity: value ?? 1 })
        }
      />
      <span className="tabular text-right text-body-sm font-medium">
        {formatMoney(amount, currency, { precise: true })}
      </span>
      <div className="flex items-center gap-1">
        {showTaxable && (
          <label className="flex items-center gap-1 text-[10px] text-ash">
            <input
              type="checkbox"
              checked={charge.taxable}
              disabled={!canEdit}
              onChange={(e) =>
                setCharge(trip.id, charge.id, { taxable: e.target.checked })
              }
            />
            tax
          </label>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => removeCharge(trip.id, charge.id)}
            className="text-ash hover:text-destructive"
            aria-label="Remove charge"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

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

  const baseFareCharges = trip.charges.filter((c) => c.section === "BASE_FARE");
  const itemized = trip.charges.filter((c) => c.section === "ITEMIZED");
  const taxes = trip.charges.filter((c) => c.section === "TAX");

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

  const unitFor: Record<QuoteBaseFareBasis, string> = {
    DAILY: `${trip.days || 0} days`,
    HOURLY: `${trip.hours || 0} h`,
    MILEAGE: `${trip.total_miles || 0} km`,
    BASE: "flat",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-5">
        {/* Duration inputs — feed the daily/hourly candidates */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-ash">Days</span>
            <NumericInput
              value={trip.days}
              onValueChange={(v) => setTrip(trip.id, { days: v ?? 0 })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-ash">Hours</span>
            <NumericInput
              value={trip.hours}
              onValueChange={(v) => setTrip(trip.id, { hours: v ?? 0 })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-ash">Total distance</span>
            <NumericInput
              suffix="km"
              value={trip.total_miles}
              onValueChange={(v) => setTrip(trip.id, { total_miles: v ?? 0 })}
            />
          </label>
        </div>

        {/* Base Fare */}
        <div className="rounded-xl border border-bone p-4">
          <div className="mb-3 flex items-center gap-3">
            <p className="text-body-sm font-semibold text-ink">Base Fare</p>
            <div className="flex overflow-hidden rounded-full border border-bone text-[12px] font-semibold">
              {(["HIGHEST", "CHOOSE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setTrip(trip.id, { base_fare_mode: mode })}
                  className={
                    trip.base_fare_mode === mode
                      ? "bg-ink px-3 py-1 text-signal-white"
                      : "px-3 py-1 text-slate hover:bg-mist"
                  }
                >
                  {mode === "HIGHEST" ? "Highest" : "Choose"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {candidates.map(({ basis, amount }) => {
              const selected = result.selectedBasis === basis;
              const rateKey = rateFor[basis];
              const selectable = canEdit && trip.base_fare_mode === "CHOOSE";
              return (
                <div
                  key={basis}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    selected
                      ? "border-teal-400 bg-teal-50"
                      : "border-bone"
                  }`}
                >
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() =>
                      setTrip(trip.id, {
                        base_fare_basis: basis,
                        base_fare_mode: "CHOOSE",
                      })
                    }
                    className="block w-full text-left disabled:cursor-default"
                  >
                    <span className="block text-[11px] font-semibold text-ash">
                      {BASE_FARE_BASIS_LABELS[basis]}
                      {selected && (
                        <span className="ml-1 text-teal-600">• used</span>
                      )}
                    </span>
                    <span className="tabular block text-body-sm font-semibold text-ink">
                      {money(amount)}
                    </span>
                  </button>
                  <NumericInput
                    className="mt-1 h-7 w-full"
                    prefix={basis === "MILEAGE" ? undefined : "$"}
                    value={trip[rateKey] as number}
                    onValueChange={(value) =>
                      setTrip(trip.id, { [rateKey]: value ?? 0 })
                    }
                  />
                  <span className="mt-0.5 block text-[10px] text-ash">
                    × {unitFor[basis]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Base fare charges */}
          <div className="mt-4">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => addCharge(trip.id, "BASE_FARE")}
              className="text-body-sm font-semibold text-teal-600 disabled:opacity-50"
            >
              + Base Fare Charges
            </button>
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
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-bone pt-3">
            <span className="text-body-sm font-semibold text-ink">Total Base Fare</span>
            <div className="flex items-center gap-2">
              <NumericInput
                className="h-9 w-32 text-right"
                prefix="$"
                nullable
                value={
                  trip.base_fare_override ?? toMajor(result.baseFareTotal)
                }
                onValueChange={(value) =>
                  setTrip(trip.id, { base_fare_override: value })
                }
              />
              {trip.base_fare_override !== null && canEdit && (
                <button
                  type="button"
                  onClick={() => setTrip(trip.id, { base_fare_override: null })}
                  className="text-ash hover:text-ink"
                  aria-label="Reset to calculated base fare"
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Itemized charges */}
        <div className="rounded-xl border border-bone p-4">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => addCharge(trip.id, "ITEMIZED")}
            className="text-body-sm font-semibold text-teal-600 disabled:opacity-50"
          >
            + Itemized Charges
          </button>
          {itemized.length > 0 && (
            <div className="mt-2 grid grid-cols-[1fr_120px_100px_80px_90px_auto] gap-2 px-1 text-[10px] font-semibold tracking-wide text-ash uppercase">
              <span>Description</span>
              <span>Type</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
          )}
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
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-body-sm font-semibold text-ink">Trip Subtotal</span>
          <span className="tabular text-body-sm font-semibold">
            {money(result.subtotal)}
          </span>
        </div>

        {/* Taxes */}
        <div className="rounded-xl border border-bone p-4">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => addCharge(trip.id, "TAX")}
            className="text-body-sm font-semibold text-teal-600 disabled:opacity-50"
          >
            + Taxes
          </button>
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
          <div className="mt-2 flex items-center justify-between border-t border-bone pt-2">
            <span className="text-body-sm font-semibold text-ink">Taxes</span>
            <span className="tabular text-body-sm font-semibold">
              {money(result.taxTotal)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-plaster px-4 py-3">
          <span className="text-body font-semibold text-ink">Trip Total</span>
          <span className="tabular text-body font-bold text-ink">
            {money(result.total)}
          </span>
        </div>
      </div>

      {/* Right rail */}
      <div className="space-y-4 rounded-lg border border-bone bg-mist p-5">
        <div>
          <p className="text-body-sm font-semibold text-ink">
            Choose What Customers Will See
          </p>
          <div className="mt-3 space-y-2.5">
            {QUOTE_VISIBILITY.map((value) => (
              <label key={value} className="flex items-start gap-2 text-body-sm">
                <input
                  type="radio"
                  name="visibility"
                  className="mt-0.5"
                  checked={state.header.customer_visibility === value}
                  disabled={!canEdit}
                  onChange={() =>
                    setHeader({
                      customer_visibility:
                        value as typeof state.header.customer_visibility,
                    })
                  }
                />
                <span className="text-slate">{VISIBILITY_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-bone pt-4">
          <span className="text-body-sm font-semibold text-ink">Trip Total</span>
          <span className="tabular text-body-sm font-bold">{money(result.total)}</span>
        </div>
        <div className="flex items-center justify-between text-body-sm text-slate">
          <span>Due on booking</span>
          <span className="tabular">{money(result.dueNow)}</span>
        </div>
      </div>
    </div>
  );
}
