import { z } from "zod";

/**
 * Argument schemas for every tool the assistant may call.
 *
 * These are the trust boundary. A model can emit any JSON it likes; nothing
 * reaches the database until it has been through the matching schema here.
 */

export const searchTripsSchema = z.object({
  query: z
    .string()
    .max(120)
    .optional()
    .describe(
      "Free text to match against the reservation number, group name, pickup or destination.",
    ),
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional()
    .describe("Restrict to one trip status."),
  crew: z
    .enum(["NO_DRIVER", "NO_VEHICLE", "UNCREWED", "CREWED"])
    .optional()
    .describe(
      "Restrict by crew: NO_DRIVER (no driver assigned), NO_VEHICLE (no vehicle assigned), UNCREWED (missing either), CREWED (has both).",
    ),
  from: z
    .string()
    .optional()
    .describe("ISO date. Only trips departing on or after this."),
  to: z.string().optional().describe("ISO date. Only trips departing on or before this."),
  limit: z.number().int().min(1).max(25).optional(),
});

export const getTripDetailsSchema = z.object({
  tripId: z.string().describe("The trip's id, as returned by searchTrips."),
});

export const searchCustomersSchema = z.object({
  query: z.string().max(120).describe("Name, company, email or phone fragment."),
  limit: z.number().int().min(1).max(25).optional(),
});

export const availabilitySchema = z.object({
  departureAt: z
    .string()
    .describe(
      "When the trip starts. ISO 8601, or a plain 'YYYY-MM-DDTHH:mm' read in the operator's timezone.",
    ),
  returnAt: z
    .string()
    .optional()
    .describe("When it ends. Omit for a single day."),
  passengerCount: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe("Used to work out how many vehicles are needed."),
});

export const calculateQuoteSchema = z.object({
  vehicleTypeName: z
    .string()
    .describe("Name of the vehicle type whose stored rates should be used."),
  vehicleCount: z.number().int().min(1).max(50),
  distanceKm: z.number().min(0).max(20000),
  durationHours: z.number().min(0).max(2000),
  extraFuel: z.number().min(0).optional(),
  extraTolls: z.number().min(0).optional(),
  extraServices: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
});

export const draftCustomerMessageSchema = z.object({
  purpose: z
    .enum(["QUOTE_FOLLOW_UP", "ASK_FOR_DETAILS", "DECLINE", "CONFIRMATION", "APOLOGY"])
    .describe("What the message needs to achieve."),
  context: z
    .string()
    .max(1500)
    .describe("Facts to include. Only use details you have already looked up."),
  customerName: z.string().max(120).optional(),
});

export const createTripRequestSchema = z.object({
  pickupLocation: z.string().min(1).max(160),
  destination: z.string().min(1).max(160),
  departureAt: z
    .string()
    .describe("'YYYY-MM-DDTHH:mm', read in the operator's timezone."),
  returnAt: z.string().optional(),
  passengerCount: z.number().int().min(1).max(5000),
  contactName: z.string().max(120).optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().max(32).optional(),
  specialRequirements: z.string().max(2000).optional(),
});

export const operationsSummarySchema = z.object({
  focus: z
    .enum(['TODAY', 'WEEK', 'ATTENTION'])
    .optional()
    .describe('TODAY for today, WEEK for the week ahead, ATTENTION for what is overdue or unstaffed.'),
});

export const searchTripRequestsSchema = z.object({
  status: z
    .enum(['NEW', 'REVIEWING', 'NEEDS_INFORMATION', 'QUOTED', 'ACCEPTED', 'DECLINED', 'EXPIRED'])
    .optional(),
  query: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

/** Mutating tools. The loop stops on these and asks the operator to confirm. */
export const acceptTripRequestToolSchema = z.object({
  tripRequestId: z.string().describe('Id from searchTripRequests.'),
});

export const setTripRequestStatusToolSchema = z.object({
  tripRequestId: z.string(),
  status: z.enum(['NEW', 'REVIEWING', 'NEEDS_INFORMATION', 'DECLINED']),
  note: z.string().max(500).optional().describe("Recorded on the request's activity log."),
});

export const assignCrewToolSchema = z.object({
  tripId: z.string().describe('Id from searchTrips.'),
  vehicleId: z.string().optional().describe('Id from getVehicleAvailability.'),
  driverId: z.string().optional().describe('Id from getDriverAvailability.'),
});

export const setTripStatusToolSchema = z.object({
  tripId: z.string(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const createCustomerToolSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.email().optional(),
  phone: z.string().max(32).optional(),
  company: z.string().max(160).optional(),
});

export const emptySchema = z.object({});

/**
 * Zod → JSON Schema for the tools payload.
 *
 * `io: "input"` matters: without it, schemas carrying transforms describe the
 * output shape, and the model would be told to send what our code produces
 * rather than what it accepts.
 */
/**
 * Keywords removed before a schema is offered to the model.
 *
 * Gemini decodes function calls against the declared schemas, and one keyword
 * it cannot compile poisons every tool, not just the one that carries it: the
 * lookahead regex Zod emits for `.email()` turned every call into
 * MALFORMED_FUNCTION_CALL. None of these are needed by the model — every
 * argument is parsed by the same Zod schema on the server before it is used.
 */
const MODEL_UNSAFE_KEYWORDS = new Set(["$schema", "pattern", "format"]);

function stripUnsafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsafe);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !MODEL_UNSAFE_KEYWORDS.has(key))
      .map(([key, entry]) => [key, stripUnsafe(entry)]),
  );
}

export function toParameters(schema: z.ZodType): Record<string, unknown> {
  return stripUnsafe(
    z.toJSONSchema(schema, { io: "input", target: "draft-7" }),
  ) as Record<string, unknown>;
}
