/**
 * Quote builder pricing — the multi-trip engine behind the Pricing tab.
 *
 * Layered on top of lib/pricing/index.ts, which owns the money primitives.
 * Everything here works in integer **minor units** and is fully deterministic:
 * the same trip inputs always produce the same totals, and the browser preview
 * runs this exact module so it can never disagree with the server.
 *
 * One trip's shape (mirrors the Busify Pricing tab, top to bottom):
 *
 *   Base Fare        = max(daily, hourly, mileage, flat)   — or a chosen one,
 *                      or a hand-typed override
 *   + Base Fare Charges                                     — section BASE_FARE
 *   = Total Base Fare
 *   + Itemized Charges                                      — section ITEMIZED
 *   = Trip Subtotal
 *   + Taxes (% of the taxable subtotal)                     — section TAX
 *   = Trip Total
 *
 * The quote's deposit is the sum of every trip's "due now".
 */

import { roundHalfUp, toMinor, type Money } from "@/lib/pricing";
import type {
  QuoteBaseFareBasis,
  QuoteBaseFareMode,
  QuoteChargeKind,
  QuoteChargeSection,
} from "@/types/database";

export type ChargeInput = {
  section: QuoteChargeSection;
  label: string;
  kind: QuoteChargeKind;
  /** Percent for PERCENT; a major-unit price for FLAT / PER_*. */
  rate: number;
  quantity: number;
  /** ITEMIZED only: do TAX rows apply on top of this charge. */
  taxable: boolean;
};

export type ChargeResult = ChargeInput & { amount: Money };

export type TripPricingInput = {
  baseFareMode: QuoteBaseFareMode;
  baseFareBasis: QuoteBaseFareBasis | null;
  rateDaily: number;
  rateHourly: number;
  ratePerMile: number;
  rateFlatBase: number;
  /** The "Total Base Fare" field, when the operator has typed over the calc. */
  baseFareOverride: number | null;
  days: number;
  hours: number;
  totalMiles: number;
  charges: ChargeInput[];
  dueNowPercent: number;
  dueNowAmount: number | null;
};

export type TripPricingResult = {
  candidates: { daily: Money; hourly: Money; mileage: Money; base: Money };
  selectedBasis: QuoteBaseFareBasis;
  /** True when baseFare came from the override field, not the calculation. */
  baseFareOverridden: boolean;
  baseFare: Money;
  baseFareCharges: ChargeResult[];
  baseFareTotal: Money;
  itemizedCharges: ChargeResult[];
  subtotal: Money;
  taxableBase: Money;
  taxes: ChargeResult[];
  taxTotal: Money;
  total: Money;
  dueNow: Money;
  dueLater: Money;
  /** Every charge, priced, in the exact order it was passed in. */
  charges: ChargeResult[];
};

/** quantity carries at most two decimals; scale to an integer first. */
function applyQuantity(base: Money, quantity: number): Money {
  const scaled = roundHalfUp(Math.max(quantity, 0) * 100);
  return roundHalfUp((base * scaled) / 100);
}

type ChargeContext = {
  days: number;
  hours: number;
  miles: number;
  /** Base a PERCENT charge is taken from — differs by section. */
  percentBase: Money;
};

function chargeAmount(charge: ChargeInput, ctx: ChargeContext): Money {
  const rate = Math.max(charge.rate, 0);
  let base: Money;

  switch (charge.kind) {
    case "PERCENT":
      base = roundHalfUp((ctx.percentBase * rate) / 100);
      break;
    case "PER_MILE":
      base = roundHalfUp(toMinor(rate) * Math.max(ctx.miles, 0));
      break;
    case "PER_HOUR":
      base = roundHalfUp(toMinor(rate) * Math.max(ctx.hours, 0));
      break;
    case "PER_DAY":
      base = roundHalfUp(toMinor(rate) * Math.max(ctx.days, 0));
      break;
    case "FLAT":
    default:
      base = toMinor(rate);
      break;
  }

  return applyQuantity(base, charge.quantity);
}

export function priceTrip(input: TripPricingInput): TripPricingResult {
  const days = Math.max(input.days, 0);
  const hours = Math.max(input.hours, 0);
  const miles = Math.max(input.totalMiles, 0);

  const candidates = {
    daily: roundHalfUp(toMinor(input.rateDaily) * days),
    hourly: roundHalfUp(toMinor(input.rateHourly) * hours),
    mileage: roundHalfUp(toMinor(input.ratePerMile) * miles),
    base: toMinor(input.rateFlatBase),
  };

  const basisFromMax = (): QuoteBaseFareBasis => {
    const entries: [QuoteBaseFareBasis, Money][] = [
      ["DAILY", candidates.daily],
      ["HOURLY", candidates.hourly],
      ["MILEAGE", candidates.mileage],
      ["BASE", candidates.base],
    ];
    return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  };

  const selectedBasis: QuoteBaseFareBasis =
    input.baseFareMode === "CHOOSE" && input.baseFareBasis
      ? input.baseFareBasis
      : basisFromMax();

  const calculatedBaseFare = {
    DAILY: candidates.daily,
    HOURLY: candidates.hourly,
    MILEAGE: candidates.mileage,
    BASE: candidates.base,
  }[selectedBasis];

  const baseFareOverridden =
    input.baseFareOverride !== null && Number.isFinite(input.baseFareOverride);
  const baseFare = baseFareOverridden
    ? toMinor(input.baseFareOverride as number)
    : calculatedBaseFare;

  // Priced in place so the original order (what the DB rows need) is preserved.
  const charges: ChargeResult[] = input.charges.map((charge) => ({
    ...charge,
    amount: 0,
  }));

  // --- Base fare charges: percent is of the base fare -----------------------
  input.charges.forEach((charge, index) => {
    if (charge.section !== "BASE_FARE") return;
    charges[index]!.amount = chargeAmount(charge, {
      days,
      hours,
      miles,
      percentBase: baseFare,
    });
  });
  const baseFareCharges = charges.filter((c) => c.section === "BASE_FARE");

  const baseFareTotal =
    baseFare + baseFareCharges.reduce((sum, charge) => sum + charge.amount, 0);

  // --- Itemized charges: percent is of the total base fare -----------------
  input.charges.forEach((charge, index) => {
    if (charge.section !== "ITEMIZED") return;
    charges[index]!.amount = chargeAmount(charge, {
      days,
      hours,
      miles,
      percentBase: baseFareTotal,
    });
  });
  const itemizedCharges = charges.filter((c) => c.section === "ITEMIZED");

  const subtotal =
    baseFareTotal + itemizedCharges.reduce((sum, charge) => sum + charge.amount, 0);

  // --- Taxes: percent is of the taxable subtotal --------------------------
  const nonTaxableItemized = itemizedCharges
    .filter((charge) => !charge.taxable)
    .reduce((sum, charge) => sum + charge.amount, 0);
  const taxableBase = subtotal - nonTaxableItemized;

  input.charges.forEach((charge, index) => {
    if (charge.section !== "TAX") return;
    charges[index]!.amount = chargeAmount(charge, {
      days,
      hours,
      miles,
      percentBase: taxableBase,
    });
  });
  const taxes = charges.filter((c) => c.section === "TAX");

  const taxTotal = taxes.reduce((sum, charge) => sum + charge.amount, 0);
  const total = subtotal + taxTotal;

  const dueNow =
    input.dueNowAmount !== null && Number.isFinite(input.dueNowAmount)
      ? Math.min(toMinor(input.dueNowAmount as number), total)
      : Math.min(
          roundHalfUp((total * Math.min(Math.max(input.dueNowPercent, 0), 100)) / 100),
          total,
        );

  return {
    candidates,
    selectedBasis,
    baseFareOverridden,
    baseFare,
    baseFareCharges,
    baseFareTotal,
    itemizedCharges,
    subtotal,
    taxableBase,
    taxes,
    taxTotal,
    total,
    dueNow,
    dueLater: total - dueNow,
    charges,
  };
}

export type QuoteRollup = {
  subtotal: Money;
  taxTotal: Money;
  total: Money;
  dueNow: Money;
  dueLater: Money;
};

export function rollUpQuote(trips: TripPricingResult[]): QuoteRollup {
  return trips.reduce<QuoteRollup>(
    (acc, trip) => ({
      subtotal: acc.subtotal + trip.subtotal,
      taxTotal: acc.taxTotal + trip.taxTotal,
      total: acc.total + trip.total,
      dueNow: acc.dueNow + trip.dueNow,
      dueLater: acc.dueLater + trip.dueLater,
    }),
    { subtotal: 0, taxTotal: 0, total: 0, dueNow: 0, dueLater: 0 },
  );
}

/** The label shown against each base-fare candidate column. */
export const BASE_FARE_BASIS_LABELS: Record<QuoteBaseFareBasis, string> = {
  DAILY: "Daily",
  HOURLY: "Hourly",
  MILEAGE: "Mileage",
  BASE: "Base Fare",
};

export const CHARGE_KIND_LABELS: Record<QuoteChargeKind, string> = {
  FLAT: "Flat amount",
  PERCENT: "Percentage",
  PER_MILE: "Per km",
  PER_HOUR: "Per hour",
  PER_DAY: "Per day",
};
