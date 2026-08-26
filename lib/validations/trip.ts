import { z } from "zod";

import { optionalText, uuid } from "./shared";

export const TRIP_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const ASSIGNMENT_ROLES = ["PRIMARY", "RELIEF"] as const;

/** Radix Select cannot hold "", so "none" travels as this sentinel. */
export const NONE = "__none__";

const optionalId = z
  .string()
  .trim()
  .transform((value) => (value === "" || value === NONE ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "That is not a valid selection",
  );

export const assignmentSchema = z
  .object({
    trip_id: uuid,
    vehicle_id: optionalId,
    driver_id: optionalId,
    role: z.enum(ASSIGNMENT_ROLES).default("PRIMARY"),
    notes: optionalText,
  })
  .refine(
    (values) => values.vehicle_id !== null || values.driver_id !== null,
    {
      message: "Pick a vehicle, a driver, or both",
      path: ["vehicle_id"],
    },
  );

export const tripStatusSchema = z.object({
  id: uuid,
  status: z.enum(TRIP_STATUSES),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
