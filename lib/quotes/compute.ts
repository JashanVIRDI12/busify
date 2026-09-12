/**
 * The bridge between the builder's state and the pricing engine.
 *
 * Both the browser preview and the server's save call `computeQuote` on the
 * same input, so the number the operator sees while typing is the number that
 * gets persisted.
 */

import {
  priceTrip,
  rollUpQuote,
  type QuoteRollup,
  type TripPricingResult,
} from "@/lib/pricing/quote";
import type {
  QuoteBuilderInput,
  QuoteTripInput,
} from "@/lib/validations/quote-builder";

export function priceTripInput(trip: QuoteTripInput): TripPricingResult {
  return priceTrip({
    baseFareMode: trip.base_fare_mode,
    baseFareBasis: trip.base_fare_basis,
    rateDaily: trip.rate_daily,
    rateHourly: trip.rate_hourly,
    ratePerMile: trip.rate_per_mile,
    rateFlatBase: trip.rate_flat_base,
    baseFareOverride: trip.base_fare_override,
    days: trip.days,
    hours: trip.hours,
    totalMiles: trip.total_miles,
    charges: trip.charges.map((charge) => ({
      section: charge.section,
      label: charge.label,
      kind: charge.kind,
      rate: charge.rate,
      quantity: charge.quantity,
      taxable: charge.taxable,
    })),
    dueNowPercent: trip.due_now_percent,
    dueNowAmount: trip.due_now_amount,
  });
}

export type QuoteComputed = {
  /** Priced result per trip, keyed by trip id. */
  byTrip: Record<string, TripPricingResult>;
  ordered: TripPricingResult[];
  rollup: QuoteRollup;
};

export function computeQuote(state: QuoteBuilderInput): QuoteComputed {
  const byTrip: Record<string, TripPricingResult> = {};
  const ordered: TripPricingResult[] = [];

  for (const trip of state.trips) {
    const result = priceTripInput(trip);
    byTrip[trip.id] = result;
    ordered.push(result);
  }

  return { byTrip, ordered, rollup: rollUpQuote(ordered) };
}
