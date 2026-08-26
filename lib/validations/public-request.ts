import { z } from "zod";

import { optionalPhone, optionalText } from "./shared";

const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Pick a date and time");

/**
 * Public quote-request form. Stricter than the internal schema because this is
 * reachable by anyone: contact details are required (an enquiry we cannot reply
 * to is worthless), and the honeypot catches the cheapest class of bot.
 */
export const publicRequestSchema = z
  .object({
    // Bots fill hidden inputs; humans never see this one.
    company_website: z.string().max(0, "Rejected").optional().default(""),

    contact_name: z
      .string()
      .trim()
      .min(2, "Tell us who to reply to")
      .max(120, "That name is too long"),
    contact_email: z.email("Enter a valid email address"),
    contact_phone: optionalPhone,

    pickup_location: z
      .string()
      .trim()
      .min(2, "Where should we collect you?")
      .max(160),
    pickup_address: optionalText,

    destination: z.string().trim().min(2, "Where are you going?").max(160),
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
      .max(5000, "Please call us directly for a group that size"),

    special_requirements: z
      .string()
      .trim()
      .max(2000, "Please keep this under 2000 characters")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine(
    (values) => values.return_at === null || values.return_at > values.departure_at,
    { message: "The return must be after departure", path: ["return_at"] },
  );

export type PublicRequestInput = z.infer<typeof publicRequestSchema>;
