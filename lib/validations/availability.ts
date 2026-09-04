import { z } from "zod";

import { optionalText, uuid } from "./shared";

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/** A driver blocking off time they are not available. */
export const unavailabilitySchema = z
  .object({
    starts_at: z
      .string()
      .trim()
      .regex(DATETIME_LOCAL, "Pick a valid start date and time"),
    ends_at: z
      .string()
      .trim()
      .regex(DATETIME_LOCAL, "Pick a valid end date and time"),
    reason: optionalText,
  })
  .refine((v) => v.ends_at > v.starts_at, {
    message: "The end must be after the start",
    path: ["ends_at"],
  });

export const removeUnavailabilitySchema = z.object({ id: uuid });

export type UnavailabilityInput = z.infer<typeof unavailabilitySchema>;
