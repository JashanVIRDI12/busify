import type { QuoteItemKind } from "@/types/database";

/**
 * Deterministic quote pricing.
 *
 * Every amount in this module is an integer number of **minor units** (paise,
 * cents). Money is never held in a float here: 0.1 + 0.2 problems are
 * unacceptable on a customer-facing total, and `numeric(12,2)` in Postgres is
 * exact, so the only lossy step would be arithmetic in JavaScript. Conversion
 * to major units happens once, at the database boundary, via `toMajor`.
 *
 * No model, heuristic, or network call participates in these numbers — the
 * same inputs always produce the same total.
 */
export type Money = number;

export type QuoteLineInput = {
  kind: QuoteItemKind;
  description: string;
  /** Up to two decimal places (hours, kilometres, vehicle counts). */
  quantity: number;
  unitPrice: Money;
};

export type QuoteLine = QuoteLineInput & { amount: Money };

export type PricingInput = {
  lines: QuoteLineInput[];
  /** Absolute reduction, not a percentage. Clamped to the subtotal. */
  discount: Money;
  /** Percentage, e.g. 5 or 18. Applied after the discount. */
  taxRatePercent: number;
  /** Percentage of the total requested up front. */
  depositPercent: number;
};

export type PricingResult = {
  lines: QuoteLine[];
  subtotal: Money;
  discount: Money;
  /** Subtotal less discount — what tax is charged on. */
  taxable: Money;
  tax: Money;
  total: Money;
  deposit: Money;
  balance: Money;
};

/**
 * Half-up rounding, sign-aware.
 *
 * `Math.round` breaks ties toward positive infinity, so -0.5 becomes -0 rather
 * than -1. Money rounding must be symmetric about zero or refunds and credits
 * drift by a unit.
 */
export function roundHalfUp(value: number): Money {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Major units (what the database stores) → minor units. */
export function toMinor(major: number | string): Money {
  return roundHalfUp(Number(major) * 100);
}

/** Minor units → major units, for `numeric(12,2)` columns. */
export function toMajor(minor: Money): number {
  return roundHalfUp(minor) / 100;
}

function lineAmount(line: QuoteLineInput): Money {
  // Scale the quantity to an integer first so the product is exact before the
  // single rounding step. Quantities carry at most two decimals.
  const scaledQuantity = roundHalfUp(line.quantity * 100);
  return roundHalfUp((scaledQuantity * line.unitPrice) / 100);
}

export function priceQuote(input: PricingInput): PricingResult {
  const lines: QuoteLine[] = input.lines.map((line) => ({
    ...line,
    amount: lineAmount(line),
  }));

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);

  // A discount can never exceed the work, and never turns a quote negative.
  const discount = Math.min(Math.max(roundHalfUp(input.discount), 0), Math.max(subtotal, 0));

  const taxable = subtotal - discount;
  const taxRate = Math.max(input.taxRatePercent, 0);
  const tax = roundHalfUp((taxable * taxRate) / 100);
  const total = taxable + tax;

  const depositPercent = Math.min(Math.max(input.depositPercent, 0), 100);
  const deposit = Math.min(roundHalfUp((total * depositPercent) / 100), total);
  const balance = total - deposit;

  return { lines, subtotal, discount, taxable, tax, total, deposit, balance };
}

export type VehicleTypeRates = {
  name: string;
  base_rate: number | string;
  per_km_rate: number | string;
  per_hour_rate: number | string;
};

export type SuggestionInput = {
  vehicleType: VehicleTypeRates;
  vehicleCount: number;
  distanceKm: number;
  durationHours: number;
};

/**
 * Starting line items for a quote, derived from the vehicle type's stored
 * rates. The operator edits these before sending — this is a first draft, not
 * a fixed price.
 *
 * Distance and time are charged per vehicle, so quantities are coach-kilometres
 * and coach-hours. The descriptions say so, because a customer reading "1120"
 * against a 560 km trip deserves an explanation.
 */
export function suggestLines({
  vehicleType,
  vehicleCount,
  distanceKm,
  durationHours,
}: SuggestionInput): QuoteLineInput[] {
  const count = Math.max(Math.trunc(vehicleCount), 1);
  const lines: QuoteLineInput[] = [];

  const base = toMinor(vehicleType.base_rate);
  const perKm = toMinor(vehicleType.per_km_rate);
  const perHour = toMinor(vehicleType.per_hour_rate);

  if (base > 0) {
    lines.push({
      kind: "VEHICLE",
      description: `${vehicleType.name} — base charge`,
      quantity: count,
      unitPrice: base,
    });
  }

  if (perKm > 0 && distanceKm > 0) {
    lines.push({
      kind: "MILEAGE",
      description:
        count > 1
          ? `Distance — ${distanceKm} km × ${count} vehicles`
          : `Distance — ${distanceKm} km`,
      quantity: roundHalfUp(distanceKm * count * 100) / 100,
      unitPrice: perKm,
    });
  }

  if (perHour > 0 && durationHours > 0) {
    lines.push({
      kind: "DRIVER",
      description:
        count > 1
          ? `Driver hours — ${durationHours} h × ${count} vehicles`
          : `Driver hours — ${durationHours} h`,
      quantity: roundHalfUp(durationHours * count * 100) / 100,
      unitPrice: perHour,
    });
  }

  return lines;
}

export const QUOTE_ITEM_KIND_LABELS: Record<QuoteItemKind, string> = {
  VEHICLE: "Vehicle",
  DRIVER: "Driver",
  FUEL: "Fuel",
  MILEAGE: "Mileage",
  TOLLS: "Tolls",
  ADDITIONAL_SERVICE: "Additional service",
  OTHER: "Other",
};
