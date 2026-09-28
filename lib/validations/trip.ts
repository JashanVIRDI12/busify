import { z } from "zod";

import { RESERVATION_TIMES } from "@/lib/reservation-times";

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

const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Pick a date and time");

const optionalLocalDateTime = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || localDateTime.safeParse(value).success,
    "Pick a valid date and time",
  );

/** A coordinate from a picked address suggestion; "" when it was typed. */
const optionalCoordinate = (limit: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || (Number.isFinite(value) && Math.abs(value) <= limit),
      "That location could not be read",
    );

/**
 * The reservation's own facts, as the edit dialog submits them. Times arrive
 * as wall-clock values in the operator's timezone; the action converts them.
 */
export const reservationUpdateSchema = z
  .object({
    id: uuid,
    group_name: optionalText,
    passenger_count: z.coerce
      .number<number>()
      .int("Passenger count must be a whole number")
      .min(0, "Passenger count cannot be negative")
      .max(5000, "That is more passengers than we can plan for"),
    pickup_location: z.string().trim().min(1, "Where does the trip start?").max(300),
    pickup_lat: optionalCoordinate(90),
    pickup_lng: optionalCoordinate(180),
    destination: z.string().trim().min(1, "Where is it going?").max(300),
    destination_lat: optionalCoordinate(90),
    destination_lng: optionalCoordinate(180),
    garage_arrival_at: optionalLocalDateTime,
    spot_at: optionalLocalDateTime,
    departure_at: localDateTime,
    dropoff_at: optionalLocalDateTime,
    return_at: optionalLocalDateTime,
    notes: optionalText,
  })
  .superRefine((values, ctx) => {
    // Same zone, same format, so the strings compare in time order.
    let previous: { label: string; value: string } | null = null;
    for (const { key, label } of RESERVATION_TIMES) {
      const value = values[key]?.slice(0, 16);
      if (!value) continue;
      if (previous && value < previous.value) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${label} must be after ${previous.label.toLowerCase()}`,
        });
      }
      previous = { label, value };
    }
  });
