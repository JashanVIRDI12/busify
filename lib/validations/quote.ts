import { z } from "zod";

import { optionalDate, optionalText, uuid } from "./shared";

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export const QUOTE_ITEM_KINDS = [
  "VEHICLE",
  "DRIVER",
  "FUEL",
  "MILEAGE",
  "TOLLS",
  "ADDITIONAL_SERVICE",
  "OTHER",
] as const;

/** Radix Select cannot hold "", so "none" travels as this sentinel. */
export const NO_SELECTION = "__none__";

const money = z.coerce
  .number<number>()
  .min(0, "Cannot be negative")
  .max(99_999_999, "That is larger than a quote can hold");

const percent = z.coerce
  .number<number>()
  .min(0, "Cannot be negative")
  .max(100, "Cannot exceed 100%");

/**
 * Inputs the operator gives the pricing engine. Totals are never posted from
 * the browser — they are recomputed server-side from these fields, so a
 * tampered form cannot change what a customer is charged.
 */
export const quoteDraftSchema = z.object({
  trip_request_id: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === NO_SELECTION ? null : value))
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Choose a valid request",
    ),
  customer_id: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === NO_SELECTION ? null : value))
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Choose a valid customer",
    ),
  vehicle_type_id: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === NO_SELECTION ? null : value))
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Choose a valid vehicle type",
    ),

  vehicle_count: z.coerce
    .number<number>()
    .int("Whole vehicles only")
    .min(1, "At least one vehicle")
    .max(50, "That is more vehicles than we can quote here"),
  distance_km: z.coerce
    .number<number>()
    .min(0, "Cannot be negative")
    .max(20000, "That distance looks wrong"),
  duration_hours: z.coerce
    .number<number>()
    .min(0, "Cannot be negative")
    .max(2000, "That duration looks wrong"),

  extra_fuel: money.default(0),
  extra_tolls: money.default(0),
  extra_services: money.default(0),
  extra_services_label: optionalText,

  discount: money.default(0),
  tax_rate_percent: percent.default(0),
  /** Place of supply. Optional: a cross-border charter has none. */
  tax_province: optionalText,
  deposit_percent: percent.default(50),

  valid_until: optionalDate,
  notes: optionalText,
});

export const quoteIdSchema = z.object({ id: uuid });

export const quoteStatusSchema = z.object({
  id: uuid,
  status: z.enum(QUOTE_STATUSES),
});

export const publicQuoteResponseSchema = z.object({
  token: uuid,
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  message: z
    .string()
    .trim()
    .max(1000, "Please keep this under 1000 characters")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
});

export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>;
