import { z } from "zod";

import { optionalPhone, optionalText } from "./shared";

/**
 * The VIABUS site's quote form.
 *
 * Kept separate from `publicRequestSchema` rather than widening it: that schema
 * backs Busify's hosted `/book/[slug]` page, which is still a supported entry
 * point and should not start accepting fields it has no use for.
 *
 * Two differences drive the split:
 *
 * 1. The site collects a departure DATE, not a date and time — `<input
 *    type="date">`. A charter enquiry at this stage is "the 14th", not
 *    "the 14th at 09:00", so the time is filled in below rather than demanded
 *    from a customer who does not know it yet.
 * 2. It collects trip type, service type and company name, none of which have
 *    columns on `trip_requests`. They are folded into `notes` by the route so
 *    the operator sees them, instead of being silently dropped.
 *
 * Every field carries its own message for the missing/wrong-type case. Without
 * that, a request with a key absent answers with Zod's raw "expected string,
 * received undefined", which the site renders verbatim to the customer.
 */

const isoDate = z
  .string({ error: "Pick a date" })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const TRIP_TYPES = ["oneway", "return", "multiday", "shuttle"] as const;
export const SERVICE_TYPES = ["individual", "charter", "corporate"] as const;

export const viabusQuoteSchema = z
  .object({
    /**
     * Honeypot. Bots fill hidden inputs; humans never see this one.
     *
     * Deliberately NOT `.max(0)`: rejecting it here would answer the bot with a
     * 422 that names the trap, and would make the route's silent-success branch
     * unreachable. It validates like any other field; the route drops the
     * request while reporting success.
     */
    company_website: z.string().optional().default(""),

    contact_name: z
      .string({ error: "Tell us who to reply to" })
      .trim()
      .min(2, "Tell us who to reply to")
      .max(120, "That name is too long"),
    contact_email: z.email("Enter a valid email address"),
    contact_phone: optionalPhone,
    company: optionalText,

    pickup_location: z
      .string({ error: "Where should we collect you?" })
      .trim()
      .min(2, "Where should we collect you?")
      .max(160, "That pickup location is too long"),
    destination: z
      .string({ error: "Where are you going?" })
      .trim()
      .min(2, "Where are you going?")
      .max(160, "That destination is too long"),

    departure_date: isoDate,
    return_date: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null)
      .refine(
        (value) => value === null || isoDate.safeParse(value).success,
        "Pick a valid return date",
      ),

    passenger_count: z.coerce
      .number<number>({ error: "How many passengers?" })
      .int("Passenger count must be a whole number")
      .min(1, "There must be at least one passenger")
      .max(5000, "Please call us directly for a group that size"),

    trip_type: z.enum(TRIP_TYPES).default("oneway"),
    service_type: z.enum(SERVICE_TYPES).default("individual"),

    special_requirements: z
      .string()
      .trim()
      .max(2000, "Please keep this under 2000 characters")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine(
    (values) =>
      values.return_date === null || values.return_date >= values.departure_date,
    { message: "The return cannot be before departure", path: ["return_date"] },
  );

export type ViabusQuoteInput = z.infer<typeof viabusQuoteSchema>;

/**
 * Where a date-only enquiry lands on the clock, in the operator's timezone.
 * An early-morning default reads as a full day's availability to dispatch;
 * the operator sets the real time when the trip is confirmed.
 */
export const ASSUMED_DEPARTURE_TIME = "09:00";
export const ASSUMED_RETURN_TIME = "17:00";

const TRIP_TYPE_LABELS: Record<(typeof TRIP_TYPES)[number], string> = {
  oneway: "One-way",
  return: "Round trip",
  multiday: "Multi-day tour",
  shuttle: "Regular shuttle",
};

const SERVICE_TYPE_LABELS: Record<(typeof SERVICE_TYPES)[number], string> = {
  individual: "Individual seat",
  charter: "Charter coach",
  corporate: "Corporate shuttle",
};

/**
 * The fields the site collects that the schema has nowhere to put, rendered as
 * operator-readable notes.
 */
export function intakeNotes(input: ViabusQuoteInput): string {
  const lines = [
    `Trip type: ${TRIP_TYPE_LABELS[input.trip_type]}`,
    `Service: ${SERVICE_TYPE_LABELS[input.service_type]}`,
  ];

  if (input.company) lines.push(`Company: ${input.company}`);

  lines.push(
    `Submitted with a date only — departure time assumed ${ASSUMED_DEPARTURE_TIME}` +
      (input.return_date ? `, return ${ASSUMED_RETURN_TIME}.` : ".") +
      " Confirm with the customer.",
  );

  return lines.join("\n");
}
