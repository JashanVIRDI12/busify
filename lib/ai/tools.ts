import "server-only";

import type { z } from "zod";

import type { Session } from "@/lib/auth/session";
import { formatDateTime, zonedTimeToUtc } from "@/lib/datetime";
import { priceQuote, suggestLines, toMajor, toMinor } from "@/lib/pricing";
import { getFleetAvailability } from "@/lib/queries/availability";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { ToolDefinition } from "./client";
import { ACTION_NAMES, isActionName } from "./actions";
import {
  acceptTripRequestToolSchema,
  assignCrewToolSchema,
  createCustomerToolSchema,
  operationsSummarySchema,
  searchTripRequestsSchema,
  setTripRequestStatusToolSchema,
  setTripStatusToolSchema,
  availabilitySchema,
  calculateQuoteSchema,
  createTripRequestSchema,
  draftCustomerMessageSchema,
  emptySchema,
  getTripDetailsSchema,
  searchCustomersSchema,
  searchTripsSchema,
  toParameters,
} from "./schemas";

/**
 * Tool execution.
 *
 * Two properties matter here and neither is negotiable:
 *
 * 1. Every query runs on the request-scoped Supabase client, which carries the
 *    operator's session. Row Level Security therefore scopes tool results to
 *    their organization automatically — the assistant cannot reach another
 *    tenant's data even if the model asks it to. No tool takes an
 *    organization_id argument, so there is nothing to manipulate.
 *
 * 2. Arguments are parsed by Zod before touching the database. A model
 *    hallucinating a malformed id gets a validation error, not a query.
 */

type ToolContext = { session: Session };

type ToolHandler = (args: unknown, context: ToolContext) => Promise<unknown>;

type Tool = {
  definition: ToolDefinition;
  schema: z.ZodType;
  handler: ToolHandler;
  /** Tools that change data need a role check on top of RLS. */
  mutates?: boolean;
};

/** Accepts a full ISO string or a local 'YYYY-MM-DDTHH:mm' in the org's zone. */
function resolveInstant(value: string, timeZone: string): string | null {
  const local = zonedTimeToUtc(value, timeZone);
  if (local) return local;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const TOOLS: Record<string, Tool> = {
  searchTrips: {
    schema: searchTripsSchema,
    definition: {
      type: "function",
      function: {
        name: "searchTrips",
        description:
          "List trips on the operator's schedule, optionally filtered by text, status or date range. Use this before answering anything about upcoming or past work.",
        parameters: toParameters(searchTripsSchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = searchTripsSchema.parse(raw);
      const supabase = await createClient();

      let query = supabase
        .from("trips")
        .select("id, pickup_location, destination, departure_at, return_at, passenger_count, status")
        .order("departure_at", { ascending: true })
        .limit(args.limit ?? 10);

      if (args.status) query = query.eq("status", args.status);
      if (args.from) query = query.gte("departure_at", args.from);
      if (args.to) query = query.lte("departure_at", args.to);
      if (args.query) {
        const term = `%${args.query}%`;
        query = query.or(`pickup_location.ilike.${term},destination.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) return { error: "Could not read trips." };

      return {
        count: data.length,
        trips: data.map((trip) => ({
          id: trip.id,
          route: `${trip.pickup_location} → ${trip.destination}`,
          departure: formatDateTime(trip.departure_at, session.organization.timezone),
          return: trip.return_at
            ? formatDateTime(trip.return_at, session.organization.timezone)
            : null,
          passengers: trip.passenger_count,
          status: trip.status,
        })),
      };
    },
  },

  getTripDetails: {
    schema: getTripDetailsSchema,
    definition: {
      type: "function",
      function: {
        name: "getTripDetails",
        description:
          "Full detail for one trip, including which vehicle and driver are assigned.",
        parameters: toParameters(getTripDetailsSchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = getTripDetailsSchema.parse(raw);
      const supabase = await createClient();

      const { data: trip } = await supabase
        .from("trips")
        .select("*")
        .eq("id", args.tripId)
        .maybeSingle();

      if (!trip) return { error: "No trip with that id in this organization." };

      const { data: assignments } = await supabase
        .from("trip_assignments")
        .select("role, vehicle_id, driver_id")
        .eq("trip_id", trip.id);

      const vehicleIds = (assignments ?? []).map((a) => a.vehicle_id).filter(Boolean) as string[];
      const driverIds = (assignments ?? []).map((a) => a.driver_id).filter(Boolean) as string[];

      const [{ data: vehicles }, { data: drivers }] = await Promise.all([
        vehicleIds.length
          ? supabase.from("vehicles").select("id, name, capacity").in("id", vehicleIds)
          : Promise.resolve({ data: [] }),
        driverIds.length
          ? supabase.from("drivers").select("id, first_name, last_name").in("id", driverIds)
          : Promise.resolve({ data: [] }),
      ]);

      return {
        route: `${trip.pickup_location} → ${trip.destination}`,
        departure: formatDateTime(trip.departure_at, session.organization.timezone),
        return: trip.return_at
          ? formatDateTime(trip.return_at, session.organization.timezone)
          : null,
        passengers: trip.passenger_count,
        status: trip.status,
        notes: trip.notes,
        crew: {
          vehicles: (vehicles ?? []).map((v) => `${v.name} (${v.capacity} seats)`),
          drivers: (drivers ?? []).map((d) =>
            [d.first_name, d.last_name].filter(Boolean).join(" "),
          ),
        },
        hasDriver: driverIds.length > 0,
        hasVehicle: vehicleIds.length > 0,
      };
    },
  },

  searchCustomers: {
    schema: searchCustomersSchema,
    definition: {
      type: "function",
      function: {
        name: "searchCustomers",
        description: "Find customers by name, company, email or phone.",
        parameters: toParameters(searchCustomersSchema),
      },
    },
    handler: async (raw) => {
      const args = searchCustomersSchema.parse(raw);
      const supabase = await createClient();
      const term = `%${args.query}%`;

      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company, email, phone")
        .or(
          `first_name.ilike.${term},last_name.ilike.${term},company.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
        )
        .limit(args.limit ?? 10);

      if (error) return { error: "Could not read customers." };

      return {
        count: data.length,
        customers: data.map((c) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(" "),
          company: c.company,
          email: c.email,
          phone: c.phone,
        })),
      };
    },
  },

  getVehicleAvailability: {
    schema: availabilitySchema,
    definition: {
      type: "function",
      function: {
        name: "getVehicleAvailability",
        description:
          "Which vehicles are free across a date range, and whether they seat a given party. Checks maintenance status and existing trip assignments. Always use this before answering whether a job can be covered.",
        parameters: toParameters(availabilitySchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = availabilitySchema.parse(raw);
      const timeZone = session.organization.timezone;

      const departureAt = resolveInstant(args.departureAt, timeZone);
      if (!departureAt) return { error: "Could not read that departure date." };

      const returnAt = args.returnAt ? resolveInstant(args.returnAt, timeZone) : null;

      const availability = await getFleetAvailability({
        departure_at: departureAt,
        return_at: returnAt,
        passenger_count: args.passengerCount ?? 1,
      });

      return {
        window: {
          from: formatDateTime(departureAt, timeZone),
          to: returnAt ? formatDateTime(returnAt, timeZone) : "next day",
        },
        seatsAvailable: availability.seatsAvailable,
        vehiclesNeeded: args.passengerCount ? availability.vehiclesNeeded : null,
        canCoverParty: args.passengerCount ? availability.meetsDemand : null,
        available: availability.vehicles
          .filter((v) => v.available)
          .map((v) => ({
            name: v.vehicle.name,
            type: v.typeName,
            seats: v.vehicle.capacity,
            registration: v.vehicle.registration_number,
          })),
        unavailable: availability.vehicles
          .filter((v) => !v.available)
          .map((v) => ({ name: v.vehicle.name, seats: v.vehicle.capacity, reason: v.reason })),
      };
    },
  },

  getDriverAvailability: {
    schema: availabilitySchema,
    definition: {
      type: "function",
      function: {
        name: "getDriverAvailability",
        description:
          "Which drivers are free across a date range. Accounts for leave, existing trips and licence expiry.",
        parameters: toParameters(availabilitySchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = availabilitySchema.parse(raw);
      const timeZone = session.organization.timezone;

      const departureAt = resolveInstant(args.departureAt, timeZone);
      if (!departureAt) return { error: "Could not read that departure date." };

      const returnAt = args.returnAt ? resolveInstant(args.returnAt, timeZone) : null;

      const availability = await getFleetAvailability({
        departure_at: departureAt,
        return_at: returnAt,
        passenger_count: args.passengerCount ?? 1,
      });

      return {
        available: availability.drivers
          .filter((d) => d.available)
          .map((d) => [d.driver.first_name, d.driver.last_name].filter(Boolean).join(" ")),
        unavailable: availability.drivers
          .filter((d) => !d.available)
          .map((d) => ({
            name: [d.driver.first_name, d.driver.last_name].filter(Boolean).join(" "),
            reason: d.reason,
          })),
      };
    },
  },

  calculateQuote: {
    schema: calculateQuoteSchema,
    definition: {
      type: "function",
      function: {
        name: "calculateQuote",
        description:
          "Price a job using the operator's stored vehicle-type rates. This is the only way to produce a price — never calculate one yourself.",
        parameters: toParameters(calculateQuoteSchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = calculateQuoteSchema.parse(raw);
      const supabase = await createClient();

      const { data: types } = await supabase
        .from("vehicle_types")
        .select("name, base_rate, per_km_rate, per_hour_rate");

      const type = (types ?? []).find(
        (t) => t.name.toLowerCase() === args.vehicleTypeName.toLowerCase(),
      );

      if (!type) {
        return {
          error: `No vehicle type called "${args.vehicleTypeName}".`,
          availableTypes: (types ?? []).map((t) => t.name),
        };
      }

      const lines = suggestLines({
        vehicleType: type,
        vehicleCount: args.vehicleCount,
        distanceKm: args.distanceKm,
        durationHours: args.durationHours,
      });

      for (const [amount, kind, description] of [
        [args.extraFuel, "FUEL", "Fuel surcharge"],
        [args.extraTolls, "TOLLS", "Tolls and permits"],
        [args.extraServices, "ADDITIONAL_SERVICE", "Additional services"],
      ] as const) {
        if (amount && amount > 0) {
          lines.push({ kind, description, quantity: 1, unitPrice: toMinor(amount) });
        }
      }

      if (lines.length === 0) {
        return {
          error: `"${type.name}" has no rates set, so it cannot be priced. Set its base, per-km or hourly rate under Fleet › Vehicle types.`,
        };
      }

      const priced = priceQuote({
        lines,
        discount: toMinor(args.discount ?? 0),
        taxRatePercent: args.taxRatePercent ?? 0,
        depositPercent: args.depositPercent ?? 50,
      });

      const currency = session.organization.currency;
      const money = (minor: number) => formatMoney(toMajor(minor), currency, { precise: true });

      return {
        vehicleType: type.name,
        lines: priced.lines.map((l) => ({ description: l.description, amount: money(l.amount) })),
        subtotal: money(priced.subtotal),
        discount: money(priced.discount),
        tax: money(priced.tax),
        total: money(priced.total),
        deposit: money(priced.deposit),
        balance: money(priced.balance),
        note: "Computed by the pricing engine, not estimated.",
      };
    },
  },

  getCompanyPolicy: {
    schema: emptySchema,
    definition: {
      type: "function",
      function: {
        name: "getCompanyPolicy",
        description:
          "The operator's configured settings — currency, timezone, contact details, fleet and team size. Use this instead of assuming anything about how the company works.",
        parameters: toParameters(emptySchema),
      },
    },
    handler: async (_raw, { session }) => {
      const supabase = await createClient();

      const [{ count: vehicleCount }, { count: driverCount }, { data: types }] =
        await Promise.all([
          supabase.from("vehicles").select("id", { count: "exact", head: true }),
          supabase.from("drivers").select("id", { count: "exact", head: true }),
          supabase.from("vehicle_types").select("name, default_capacity"),
        ]);

      return {
        company: session.organization.name,
        currency: session.organization.currency,
        timezone: session.organization.timezone,
        phone: session.organization.phone,
        email: session.organization.email,
        fleetSize: vehicleCount ?? 0,
        driverCount: driverCount ?? 0,
        vehicleTypes: (types ?? []).map((t) => ({
          name: t.name,
          seats: t.default_capacity,
        })),
        // Stated plainly so the model does not invent terms and conditions.
        writtenPolicies:
          "This organization has not recorded any written policies (cancellation, deposit terms, luggage limits). Say so rather than guessing.",
      };
    },
  },

  draftCustomerMessage: {
    schema: draftCustomerMessageSchema,
    definition: {
      type: "function",
      function: {
        name: "draftCustomerMessage",
        description:
          "Get the house style for a customer-facing message. Returns guidance, not a finished message — you write it, using only facts you have looked up.",
        parameters: toParameters(draftCustomerMessageSchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = draftCustomerMessageSchema.parse(raw);

      return {
        signOff: session.organization.name,
        recipient: args.customerName ?? "the customer",
        purpose: args.purpose,
        style: [
          "Plain English, warm but businesslike. No marketing language.",
          "Lead with the answer or the ask, not with pleasantries.",
          "Include only figures and dates that appear in the context provided.",
          "If a detail is missing, ask for it rather than inventing a placeholder.",
          "Six sentences at most.",
        ],
        context: args.context,
      };
    },
  },


  getOperationsSummary: {
    schema: operationsSummarySchema,
    definition: {
      type: "function",
      function: {
        name: "getOperationsSummary",
        description:
          "A snapshot of the whole operation: revenue this month, pending requests, upcoming trips, fleet and driver status, and everything currently needing attention. Use this for any 'how are we doing', 'summary', 'brief me' or 'what needs my attention' question.",
        parameters: toParameters(operationsSummarySchema),
      },
    },
    handler: async (raw, { session }) => {
      operationsSummarySchema.parse(raw);
      const metrics = await getDashboardMetrics(session.organization.currency);
      const currency = session.organization.currency;

      return {
        revenueThisMonth: formatMoney(metrics.revenueThisMonth, currency),
        confirmedBookings: metrics.confirmedBookings,
        pendingRequests: metrics.pendingRequests,
        upcomingTrips: metrics.upcomingTrips,
        customers: metrics.customers,
        fleet: {
          total: metrics.fleet.total,
          utilizationPercent: metrics.fleet.utilization,
          byStatus: metrics.fleet.byStatus,
        },
        drivers: { total: metrics.drivers.total, byStatus: metrics.drivers.byStatus },
        needsAttention: metrics.attention.map((item) => ({
          count: item.count,
          what: item.label,
          why: item.detail,
        })),
        setupIncomplete: metrics.setup.isComplete
          ? null
          : metrics.setup.steps.filter((s) => !s.done).map((s) => s.label),
      };
    },
  },

  searchTripRequests: {
    schema: searchTripRequestsSchema,
    definition: {
      type: "function",
      function: {
        name: "searchTripRequests",
        description:
          "List incoming trip requests, optionally by status. Use this to find a request's id before acting on it.",
        parameters: toParameters(searchTripRequestsSchema),
      },
    },
    handler: async (raw, { session }) => {
      const args = searchTripRequestsSchema.parse(raw);
      const supabase = await createClient();

      let query = supabase
        .from("trip_requests")
        .select("id, reference, pickup_location, destination, departure_at, passenger_count, status, contact_name")
        .order("departure_at", { ascending: true })
        .limit(args.limit ?? 10);

      if (args.status) query = query.eq("status", args.status);
      if (args.query) {
        const term = `%${args.query}%`;
        query = query.or(
          `reference.ilike.${term},pickup_location.ilike.${term},destination.ilike.${term},contact_name.ilike.${term}`,
        );
      }

      const { data, error } = await query;
      if (error) return { error: "Could not read trip requests." };

      return {
        count: data.length,
        requests: data.map((r) => ({
          id: r.id,
          reference: r.reference,
          route: `${r.pickup_location} → ${r.destination}`,
          departure: formatDateTime(r.departure_at, session.organization.timezone),
          passengers: r.passenger_count,
          status: r.status,
          contact: r.contact_name,
        })),
      };
    },
  },

  // --- Mutating tools -----------------------------------------------------
  // These never execute inside the loop. runAssistant stops when one is called
  // and returns a proposal for the operator to confirm. The handler here only
  // exists to satisfy the type; it is never invoked.
  acceptTripRequest: {
    schema: acceptTripRequestToolSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "acceptTripRequest",
        description:
          "Accept a trip request and put it on the schedule as a trip. Proposes the change for the operator to confirm — it does not happen immediately.",
        parameters: toParameters(acceptTripRequestToolSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },

  setTripRequestStatus: {
    schema: setTripRequestStatusToolSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "setTripRequestStatus",
        description:
          "Move a trip request to reviewing, needs-information or declined, optionally with a note for the activity log. Proposes the change for confirmation.",
        parameters: toParameters(setTripRequestStatusToolSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },

  assignCrew: {
    schema: assignCrewToolSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "assignCrew",
        description:
          "Assign a vehicle and/or driver to a trip. Check availability first and use the ids those tools return. Proposes the change for confirmation.",
        parameters: toParameters(assignCrewToolSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },

  setTripStatus: {
    schema: setTripStatusToolSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "setTripStatus",
        description:
          "Move a trip through its lifecycle — confirm, dispatch, start, complete or cancel. Proposes the change for confirmation.",
        parameters: toParameters(setTripStatusToolSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },

  createCustomer: {
    schema: createCustomerToolSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "createCustomer",
        description: "Add a customer record. Proposes the change for confirmation.",
        parameters: toParameters(createCustomerToolSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },

  createTripRequest: {
    schema: createTripRequestSchema,
    mutates: true,
    definition: {
      type: "function",
      function: {
        name: "createTripRequest",
        description:
          "Log a new enquiry on the operator's board. Creates a request only — never books, quotes or confirms. Proposes the change for confirmation.",
        parameters: toParameters(createTripRequestSchema),
      },
    },
    handler: async () => ({ error: "Mutating tools are confirmed, not executed here." }),
  },
};

/** Tools whose call should pause the loop for human confirmation. */
export function isMutatingTool(name: string): boolean {
  return Boolean(TOOLS[name]?.mutates) && isActionName(name);
}

export { ACTION_NAMES };

export const toolDefinitions: ToolDefinition[] = Object.values(TOOLS).map(
  (tool) => tool.definition,
);

export async function executeTool(
  name: string,
  rawArguments: string,
  context: ToolContext,
): Promise<unknown> {
  const tool = TOOLS[name];
  if (!tool) return { error: `No tool called "${name}".` };

  let parsed: unknown;
  try {
    parsed = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return { error: "Arguments were not valid JSON." };
  }

  try {
    return await tool.handler(parsed, context);
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return {
        error: "Those arguments did not validate.",
        issues: (error as z.ZodError).issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      };
    }
    console.error(`Tool ${name} failed`, error);
    return { error: "That lookup failed." };
  }
}
