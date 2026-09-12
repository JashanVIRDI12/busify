import { z } from "zod";

import { optionalText, uuid } from "./shared";

/**
 * The payload the quote builder posts on every save.
 *
 * It is our own client sending JSON (not a browser form), so fields arrive
 * already typed. Everything is still validated: the totals the customer sees
 * are recomputed on the server from these inputs, never trusted from here.
 */

export const QUOTE_PIPELINE_STATUSES = [
  "LEAD",
  "QUOTED",
  "FOLLOW_UP",
  "WON",
  "LOST",
] as const;

export const QUOTE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const QUOTE_TRIP_TYPES = [
  "ONE_WAY",
  "ROUND_TRIP",
  "HOURLY",
  "DAILY",
  "SHUTTLE",
  "OTHER",
] as const;

export const QUOTE_VISIBILITY = [
  "LINE_ITEM_TOTALS",
  "LINE_ITEM_CALCS",
  "TOTAL_ONLY",
] as const;

export const QUOTE_STOP_KINDS = ["PICKUP", "STOP", "DROPOFF"] as const;
export const QUOTE_CHARGE_SECTIONS = ["BASE_FARE", "ITEMIZED", "TAX"] as const;
export const QUOTE_CHARGE_KINDS = [
  "FLAT",
  "PERCENT",
  "PER_MILE",
  "PER_HOUR",
  "PER_DAY",
] as const;
export const QUOTE_BASE_FARE_MODES = ["HIGHEST", "CHOOSE"] as const;
export const QUOTE_BASE_FARE_BASES = ["DAILY", "HOURLY", "MILEAGE", "BASE"] as const;
export const PAYMENT_METHOD_KINDS = ["CARD", "BANK", "CHECK", "WIRE", "OTHER"] as const;
export const QUOTE_OVERAGE_BASES = ["HOURLY", "MILEAGE", "DAILY"] as const;

const nullableUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "Invalid reference",
  );

/** "HH:MM" 24-hour, or null. */
const time = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    "Invalid time",
  );

/** "YYYY-MM-DD", or null. */
const date = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Invalid date",
  );

const nonNegative = z.coerce.number<number>().min(0).max(99_999_999).catch(0);
const percent = z.coerce.number<number>().min(0).max(100).catch(0);
const count = z.coerce.number<number>().int().min(0).max(5000);

const stopSchema = z.object({
  id: uuid,
  position: z.coerce.number<number>().int().min(0),
  kind: z.enum(QUOTE_STOP_KINDS),
  label: optionalText,
  address: optionalText,
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  stop_date: date,
  stop_time: time,
  spot_time: time,
  notes: optionalText,
  leg_miles: nonNegative.default(0),
  leg_minutes: z.coerce.number<number>().int().min(0).catch(0),
});

const vehicleSchema = z.object({
  id: uuid,
  position: z.coerce.number<number>().int().min(0),
  vehicle_type_id: nullableUuid,
  vehicle_id: nullableUuid,
  quantity: z.coerce.number<number>().int().min(1).max(100).catch(1),
});

const chargeSchema = z.object({
  id: uuid,
  position: z.coerce.number<number>().int().min(0),
  section: z.enum(QUOTE_CHARGE_SECTIONS),
  label: z.string().trim().max(160).default(""),
  kind: z.enum(QUOTE_CHARGE_KINDS),
  rate: z.coerce.number<number>().min(-99_999_999).max(99_999_999).catch(0),
  quantity: z.coerce.number<number>().min(0).max(99_999).catch(1),
  taxable: z.boolean().default(true),
});

const tripSchema = z.object({
  id: uuid,
  position: z.coerce.number<number>().int().min(0),
  name: z.string().trim().min(1).max(80).default("Trip 1"),
  trip_type: z.enum(QUOTE_TRIP_TYPES).nullable().default(null),
  passenger_count: count.nullable().default(null),
  driver_count: z.coerce.number<number>().int().min(0).max(50).nullable().default(null),
  trip_contact_name: optionalText,
  trip_contact_email: optionalText,
  trip_contact_phone: optionalText,

  departing_garage_id: nullableUuid,
  departing_note: optionalText,
  departing_date: date,
  departing_time: time,
  departing_arrival_time: time,
  returning_garage_id: nullableUuid,
  returning_note: optionalText,
  returning_date: date,
  returning_time: time,
  return_leg_miles: nonNegative.default(0),
  return_leg_minutes: z.coerce.number<number>().int().min(0).catch(0),

  base_fare_mode: z.enum(QUOTE_BASE_FARE_MODES).default("HIGHEST"),
  base_fare_basis: z.enum(QUOTE_BASE_FARE_BASES).nullable().default(null),
  rate_daily: nonNegative.default(0),
  rate_hourly: nonNegative.default(0),
  rate_per_mile: nonNegative.default(0),
  rate_flat_base: nonNegative.default(0),
  base_fare_override: z.number().min(0).max(99_999_999).nullable().default(null),

  days: nonNegative.default(0),
  hours: nonNegative.default(0),
  total_miles: nonNegative.default(0),
  dead_miles: nonNegative.default(0),
  live_miles: nonNegative.default(0),
  estimated_minutes: z.coerce.number<number>().int().min(0).catch(0),

  due_now_percent: percent.default(0),
  due_now_amount: z.number().min(0).max(99_999_999).nullable().default(null),
  balance_due_date: date,

  recurrence: z.unknown().nullable().default(null),
  notes: optionalText,

  stops: z.array(stopSchema).max(60).default([]),
  vehicles: z.array(vehicleSchema).max(30).default([]),
  charges: z.array(chargeSchema).max(120).default([]),
});

const paymentMethodSchema = z.object({
  id: uuid,
  method: z.enum(PAYMENT_METHOD_KINDS),
  position: z.coerce.number<number>().int().min(0),
  enabled: z.boolean().default(false),
  online_processing: z.boolean().default(false),
  processing_fee_percent: percent.default(0),
  customer_note: optionalText,
});

export const quoteHeaderSchema = z.object({
  title: z.string().trim().min(1).max(160).default("New Quote"),
  pipeline_status: z.enum(QUOTE_PIPELINE_STATUSES).default("LEAD"),
  priority: z.enum(QUOTE_PRIORITIES).nullable().default(null),
  sales_rep_id: nullableUuid,
  event_name: optionalText,
  referred_by: optionalText,
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  customer_id: nullableUuid,
  billing_customer_id: nullableUuid,
  customer_visibility: z.enum(QUOTE_VISIBILITY).default("LINE_ITEM_CALCS"),
  allow_instant_booking: z.boolean().default(true),
  allow_pay_later: z.boolean().default(false),
  allow_full_card_payment: z.boolean().default(true),
  po_number: optionalText,
  po_only: z.boolean().default(false),
  payment_policy: z.string().trim().max(10_000).nullable().default(null),
  require_signature: z.boolean().default(false),
  expiry_days: z.coerce.number<number>().int().min(1).max(365).nullable().default(null),
  expiry_anchor: z.enum(["FIRST_SENT", "LAST_SENT"]).default("LAST_SENT"),
  contract_terms_id: nullableUuid,
  overage_basis: z.enum(QUOTE_OVERAGE_BASES).nullable().default(null),
  overage_rate: z.number().min(0).max(99_999_999).nullable().default(null),
  notes: z.string().trim().max(20_000).nullable().default(null),
});

export const quoteBuilderSchema = z.object({
  id: uuid,
  header: quoteHeaderSchema,
  trips: z.array(tripSchema).min(1).max(20),
  paymentMethods: z.array(paymentMethodSchema).max(5).default([]),
});

export type QuoteBuilderInput = z.infer<typeof quoteBuilderSchema>;
export type QuoteTripInput = z.infer<typeof tripSchema>;
export type QuoteStopInput = z.infer<typeof stopSchema>;
export type QuoteChargeInput = z.infer<typeof chargeSchema>;
export type QuoteVehicleInput = z.infer<typeof vehicleSchema>;
export type QuotePaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type QuoteHeaderInput = z.infer<typeof quoteHeaderSchema>;
