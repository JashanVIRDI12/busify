import { defaultTaxRate, describeTaxRate } from "@/lib/tax/canada";
import type { TablesInsert } from "@/types/database";

/**
 * What a brand-new quote starts life with.
 *
 * These used to live inside the Server Action that seeded a draft row. They
 * moved here when "Add Quote" stopped writing to the database: the new-quote
 * screen has to show exactly the same defaults *before* anything is saved, so
 * the shape of a new quote can no longer be something only an insert knows.
 * One definition, used by the in-memory model and by the seeder alike.
 */

/** Card / Bank / Check / Wire / Other, in the order Busify shows them. */
export function defaultPaymentMethods(quoteId: string, organizationId: string) {
  const base = { organization_id: organizationId, quote_id: quoteId };
  return [
    { ...base, method: "CARD" as const, position: 0, enabled: true, online_processing: true },
    { ...base, method: "BANK" as const, position: 1, enabled: true, online_processing: true },
    { ...base, method: "CHECK" as const, position: 2, enabled: true, online_processing: false },
    { ...base, method: "WIRE" as const, position: 3, enabled: false, online_processing: false },
    { ...base, method: "OTHER" as const, position: 4, enabled: false, online_processing: false },
  ];
}

/**
 * Settings uses three rate types; the quote engine has five kinds. "Per
 * quantity" is a flat rate multiplied by a quantity the operator sets on the
 * quote, so it seeds as FLAT rather than needing a kind of its own.
 */
export function chargeKind(
  rateType: "FLAT" | "PER_QUANTITY" | "PERCENTAGE",
): "FLAT" | "PERCENT" {
  return rateType === "PERCENTAGE" ? "PERCENT" : "FLAT";
}

/** The seed HST/GST tax row for a new trip, from the place of supply. */
export function defaultTaxCharge(
  quoteTripId: string,
  organizationId: string,
  province: string | null,
  gstNumber: string | null,
): TablesInsert<"quote_trip_charges"> {
  const rate = defaultTaxRate(province);
  const label = gstNumber
    ? `${describeTaxRate(rate, province)}# ${gstNumber}`
    : describeTaxRate(rate, province);

  return {
    organization_id: organizationId,
    quote_trip_id: quoteTripId,
    section: "TAX",
    position: 0,
    label,
    kind: "PERCENT",
    rate,
    quantity: 1,
    amount: 0,
    taxable: false,
  };
}
