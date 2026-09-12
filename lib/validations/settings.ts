import { z } from "zod";

import {
  checkboxValue,
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUuid,
} from "./shared";

/* -------------------------------------------------------------------------- */
/* Company                                                                    */
/* -------------------------------------------------------------------------- */

/** A hex colour, or nothing. Stored uppercase so two spellings never differ. */
const optionalHex = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toUpperCase()))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || /^#[0-9A-F]{6}$/.test(value),
    "Use a six-digit hex colour, like #F97B41",
  );

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.url().safeParse(value).success,
    "Enter a full URL, including https://",
  );

export const companyProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name is required")
    .max(120, "That name is too long"),
  website: optionalUrl,
  email_sender_name: optionalText,
  email: optionalEmail,
  bcc_email: optionalEmail,
  sales_phone: optionalPhone,
  operations_phone: optionalPhone,
  fax: optionalPhone,
  dot_number: optionalText,
  facebook_url: optionalUrl,
  instagram_url: optionalUrl,
  twitter_url: optionalUrl,
  address: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  gst_hst_number: optionalText,
});

export const brandingSchema = z.object({
  brand_primary_color: optionalHex,
  brand_secondary_color: optionalHex,
  logo_url: optionalText,
  favicon_url: optionalText,
});

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

export const PRICING_BASES = ["DAILY", "HOURLY", "MILEAGE", "BASE"] as const;

export const defaultsSchema = z.object({
  default_garage_id: optionalUuid,
  pre_trip_arrival_minutes: z.coerce
    .number<number>()
    .int()
    .min(0, "Cannot be negative")
    .max(480, "That is more than eight hours"),
  spot_time_minutes: z.coerce
    .number<number>()
    .int()
    .min(0, "Cannot be negative")
    .max(480, "That is more than eight hours"),
  pricing_mode: z.enum(["HIGHEST", "CHOOSE"]),
  customer_visibility: z.enum([
    "LINE_ITEM_TOTALS",
    "LINE_ITEM_CALCS",
    "TOTAL_ONLY",
  ]),
  enable_sales_tax: checkboxValue,
  enable_tracking_link: checkboxValue,
});

export type DefaultsInput = z.infer<typeof defaultsSchema>;

/* -------------------------------------------------------------------------- */
/* Driver pay settings                                                        */
/* -------------------------------------------------------------------------- */

export const driverPaySettingsSchema = z.object({
  driver_pay_method: z.enum(["HOURLY", "PERCENTAGE"]),
  long_day_enabled: checkboxValue,
  long_day_hours: z.coerce
    .number<number>()
    .int()
    .min(1, "Must be at least an hour")
    .max(24, "A day is 24 hours"),
  long_day_switch_to: z.enum(["DAILY_RATE", "HOURS"]),
  overnight_enabled: checkboxValue,
  overnight_switch_to: z.enum(["DAILY_RATE", "HOURS"]),
  percentage_of_total: checkboxValue,
  per_trip_minimum_enabled: checkboxValue,
  per_trip_minimum_by_hours: checkboxValue,
  per_diem_enabled: checkboxValue,
  per_diem_min_days: z.coerce
    .number<number>()
    .int()
    .min(1, "Must be at least one day")
    .max(30, "That is more than a month"),
});

/* -------------------------------------------------------------------------- */
/* Rate card                                                                  */
/* -------------------------------------------------------------------------- */

const money = (label: string) =>
  z.coerce.number<number>().min(0, `${label} cannot be negative`);

export const vehicleRateSchema = z.object({
  vehicle_type_id: optionalUuid,
  vehicle_id: optionalUuid,
  live_mile_rate: money("Live rate"),
  dead_mile_rate: money("Dead rate"),
  hourly_rate: money("Hourly rate"),
  minimum_hours: z.coerce
    .number<number>()
    .min(0, "Minimum hours cannot be negative")
    .max(240, "That is more than ten days"),
  daily_rate: money("Daily rate"),
});

/* -------------------------------------------------------------------------- */
/* Charges, markups and taxes                                                 */
/* -------------------------------------------------------------------------- */

export const customChargeSchema = z.object({
  category: z.enum(["CHARGE", "MARKUP", "TAX"]),
  name: z
    .string()
    .trim()
    .min(1, "Give the charge a name")
    .max(120, "That name is too long"),
  rate_type: z.enum(["FLAT", "PER_QUANTITY", "PERCENTAGE"]),
  rate: z.coerce.number<number>().min(0, "Rate cannot be negative"),
  placement: z.enum(["ITEMIZED", "BASE_FARE"]),
  tax_exempt: checkboxValue,
  default_on_quote: checkboxValue,
  note: optionalText,
});

/* -------------------------------------------------------------------------- */
/* Reference data                                                             */
/* -------------------------------------------------------------------------- */

export const savedStopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the stop a name")
    .max(120, "That name is too long"),
  address: optionalText,
  notes: optionalText,
});

export const industrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the industry a name")
    .max(80, "That name is too long"),
});

export const emailTemplateSchema = z.object({
  kind: z.enum(["QUOTE_BOOKING", "QUOTE_REQUEST", "INVOICE"]),
  from_email: optionalEmail,
  subject: z.string().trim().max(200, "That subject is too long").default(""),
  body: z.string().max(20_000, "That message is too long").default(""),
  include_pdf: checkboxValue,
});

export const termsSchema = z.object({
  kind: z.enum(["CONTRACT", "QUOTE"]),
  name: z
    .string()
    .trim()
    .min(1, "Give the terms a name")
    .max(120, "That name is too long"),
  body: z.string().max(50_000, "That is too long to store").default(""),
  is_default: checkboxValue,
});

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export const inviteUserSchema = z.object({
  email: z.email("Enter a valid email address"),
  full_name: optionalText,
  role: z.enum(["ADMIN", "DISPATCHER", "STAFF", "ACCOUNTANT", "DRIVER"]),
});
