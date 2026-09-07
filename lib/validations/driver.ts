import { z } from "zod";

import { DRIVER_LICENCE_CLASSES } from "@/lib/constants";
import {
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUuid,
} from "./shared";

export const DRIVER_STATUSES = [
  "ACTIVE",
  "OFF_DUTY",
  "ON_TRIP",
  "ON_LEAVE",
  "INACTIVE",
] as const;

/** Radix Select cannot hold "", so "not recorded" travels as this sentinel. */
export const NO_LICENCE_CLASS = "__none__";

const LICENCE_CLASS_VALUES = DRIVER_LICENCE_CLASSES.map((entry) => entry.value);

const licenceClass = z
  .string()
  .trim()
  .transform((value) => (value === "" || value === NO_LICENCE_CLASS ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) =>
      value === null ||
      LICENCE_CLASS_VALUES.includes(value as (typeof LICENCE_CLASS_VALUES)[number]),
    "Choose a licence class",
  );

/** An unchecked HTML checkbox submits nothing at all, hence the missing case. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((value) => value === "on" || value === "true");

export const driverSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  license_number: optionalText,
  license_class: licenceClass,
  air_brake_endorsement: checkbox,
  license_expires_on: optionalDate,
  status: z.enum(DRIVER_STATUSES).default("ACTIVE"),
  garage_id: optionalUuid,
  notes: optionalText,
});

export type DriverInput = z.infer<typeof driverSchema>;
