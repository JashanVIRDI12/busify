import { z } from "zod";

import { optionalInt, optionalText } from "./shared";

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "IN_TRIP",
  "MAINTENANCE",
  "INACTIVE",
] as const;

/**
 * Radix Select cannot hold an empty string value, so "no vehicle type" travels
 * as this sentinel and is normalised back to null here.
 */
export const NO_VEHICLE_TYPE = "__none__";

export const vehicleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the vehicle a name your dispatchers will recognize")
    .max(80),
  registration_number: z
    .string()
    .trim()
    .min(1, "Registration number is required")
    .max(32),
  capacity: z.coerce
    .number<number>()
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(200, "Capacity looks too high"),
  vehicle_type_id: z
    .string()
    .trim()
    .transform((value) =>
      value === "" || value === NO_VEHICLE_TYPE ? null : value,
    )
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Choose a valid vehicle type",
    ),
  status: z.enum(VEHICLE_STATUSES).default("AVAILABLE"),
  location: optionalText,
  year: optionalInt(1950, 2100, "Year"),
  make: optionalText,
  model: optionalText,
  notes: optionalText,
});

export const vehicleTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optionalText,
  default_capacity: optionalInt(1, 200, "Default capacity"),
  base_rate: z.coerce.number<number>().min(0, "Rates cannot be negative").default(0),
  per_km_rate: z.coerce.number<number>().min(0, "Rates cannot be negative").default(0),
  per_hour_rate: z.coerce.number<number>().min(0, "Rates cannot be negative").default(0),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type VehicleTypeInput = z.infer<typeof vehicleTypeSchema>;
