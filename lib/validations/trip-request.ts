import { z } from "zod";

import { optionalEmail, optionalPhone, optionalText } from "./shared";

export const TRIP_REQUEST_STATUSES = [
  "NEW",
  "REVIEWING",
  "NEEDS_INFORMATION",
  "QUOTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export const TRIP_REQUEST_SOURCES = [
  "DASHBOARD",
  "WEBSITE_WIDGET",
  "HOSTED_PAGE",
  "API",
  "AI",
] as const;

/** Radix Select cannot hold "", so "no customer" travels as this sentinel. */
export const NO_CUSTOMER = "__none__";

const localDateTime = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
    "Pick a date and time",
  );

export const tripRequestSchema = z
  .object({
    customer_id: z
      .string()
      .trim()
      .transform((value) => (value === "" || value === NO_CUSTOMER ? null : value))
      .nullable()
      .default(null)
      .refine(
        (value) => value === null || z.uuid().safeParse(value).success,
        "Choose a valid customer",
      ),

    pickup_location: z
      .string()
      .trim()
      .min(1, "Where does the trip start?")
      .max(160),
    pickup_address: optionalText,

    destination: z.string().trim().min(1, "Where is it going?").max(160),
    destination_address: optionalText,

    departure_at: localDateTime,
    return_at: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null)
      .refine(
        (value) => value === null || localDateTime.safeParse(value).success,
        "Pick a valid return date and time",
      ),

    passenger_count: z.coerce
      .number<number>()
      .int("Passenger count must be a whole number")
      .min(1, "There must be at least one passenger")
      .max(5000, "That is more passengers than we can plan for"),

    special_requirements: optionalText,
    notes: optionalText,

    contact_name: optionalText,
    contact_email: optionalEmail,
    contact_phone: optionalPhone,
  })
  .refine(
    (values) => values.return_at === null || values.return_at > values.departure_at,
    { message: "The return must be after departure", path: ["return_at"] },
  );

export const declineRequestSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1, "Give a reason so the record makes sense later").max(500),
});

export const requestInformationSchema = z.object({
  id: z.uuid(),
  question: z
    .string()
    .trim()
    .min(1, "What do you need from the customer?")
    .max(500),
});

export const setStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(TRIP_REQUEST_STATUSES),
});

export type TripRequestInput = z.infer<typeof tripRequestSchema>;
