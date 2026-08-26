import "server-only";

import { z } from "zod";

import type { Session } from "@/lib/auth/session";
import { zonedTimeToUtc } from "@/lib/datetime";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Mutating tools.
 *
 * These are deliberately NOT executed inside the model loop. When the model
 * asks for one, the loop stops and hands the operator a proposal to confirm.
 * A read tool returning the wrong coach is an annoyance; a write tool
 * dispatching the wrong coach on a hallucinated instruction is an incident.
 *
 * Confirmation is not security theatre layered over a weak boundary — it is a
 * second, human, gate on top of two real ones. Execution still goes through
 * Zod, a role check, and the operator's own RLS session, so a tampered
 * confirmation can only do what that operator could already do by hand.
 */

export const acceptTripRequestArgs = z.object({
  tripRequestId: z.uuid(),
});

export const setTripRequestStatusArgs = z.object({
  tripRequestId: z.uuid(),
  status: z.enum(["NEW", "REVIEWING", "NEEDS_INFORMATION", "DECLINED"]),
  note: z.string().max(500).optional(),
});

export const assignCrewArgs = z.object({
  tripId: z.uuid(),
  vehicleId: z.uuid().optional(),
  driverId: z.uuid().optional(),
});

export const setTripStatusArgs = z.object({
  tripId: z.uuid(),
  status: z.enum([
    "SCHEDULED",
    "CONFIRMED",
    "DISPATCHED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
});

export const createCustomerArgs = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.email().optional(),
  phone: z.string().max(32).optional(),
  company: z.string().max(160).optional(),
});

export const createTripRequestArgs = z.object({
  pickupLocation: z.string().min(1).max(160),
  destination: z.string().min(1).max(160),
  departureAt: z.string(),
  returnAt: z.string().optional(),
  passengerCount: z.number().int().min(1).max(5000),
  contactName: z.string().max(120).optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().max(32).optional(),
  specialRequirements: z.string().max(2000).optional(),
});

export const ACTION_SCHEMAS = {
  acceptTripRequest: acceptTripRequestArgs,
  setTripRequestStatus: setTripRequestStatusArgs,
  assignCrew: assignCrewArgs,
  setTripStatus: setTripStatusArgs,
  createCustomer: createCustomerArgs,
  createTripRequest: createTripRequestArgs,
} as const;

export type ActionName = keyof typeof ACTION_SCHEMAS;

export const ACTION_NAMES = Object.keys(ACTION_SCHEMAS) as ActionName[];

export function isActionName(value: string): value is ActionName {
  return (ACTION_NAMES as string[]).includes(value);
}

export type ProposedAction = {
  name: ActionName;
  args: Record<string, unknown>;
  /** Plain-language description the operator confirms against. */
  summary: string;
  /** Consequence worth reading twice before clicking. */
  caution?: string;
};

export type ActionResult = { ok: boolean; message: string; href?: string };

/** What the confirmation card says. Written for a dispatcher, not a developer. */
export async function describeAction(
  name: ActionName,
  args: Record<string, unknown>,
): Promise<ProposedAction> {
  const supabase = await createClient();
  const base = { name, args };

  switch (name) {
    case "acceptTripRequest": {
      const parsed = acceptTripRequestArgs.safeParse(args);
      if (!parsed.success) break;
      const { data } = await supabase
        .from("trip_requests")
        .select("reference, pickup_location, destination, passenger_count")
        .eq("id", parsed.data.tripRequestId)
        .maybeSingle();

      return {
        ...base,
        summary: data
          ? `Accept ${data.reference ?? "this request"} — ${data.pickup_location} → ${data.destination}, ${data.passenger_count} passengers`
          : "Accept this trip request",
        caution: "Creates a trip on your schedule and marks the request accepted.",
      };
    }

    case "setTripRequestStatus": {
      const parsed = setTripRequestStatusArgs.safeParse(args);
      if (!parsed.success) break;
      const { data } = await supabase
        .from("trip_requests")
        .select("reference")
        .eq("id", parsed.data.tripRequestId)
        .maybeSingle();

      const labels: Record<string, string> = {
        NEW: "New",
        REVIEWING: "Reviewing",
        NEEDS_INFORMATION: "Needs information",
        DECLINED: "Declined",
      };

      return {
        ...base,
        summary: `Set ${data?.reference ?? "the request"} to ${labels[parsed.data.status]}`,
        caution:
          parsed.data.status === "DECLINED"
            ? "Declining tells your team this job is not going ahead."
            : undefined,
      };
    }

    case "assignCrew": {
      const parsed = assignCrewArgs.safeParse(args);
      if (!parsed.success) break;

      const [trip, vehicle, driver] = await Promise.all([
        supabase
          .from("trips")
          .select("pickup_location, destination")
          .eq("id", parsed.data.tripId)
          .maybeSingle(),
        parsed.data.vehicleId
          ? supabase.from("vehicles").select("name").eq("id", parsed.data.vehicleId).maybeSingle()
          : Promise.resolve({ data: null }),
        parsed.data.driverId
          ? supabase
              .from("drivers")
              .select("first_name, last_name")
              .eq("id", parsed.data.driverId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const crew = [
        vehicle.data?.name,
        driver.data
          ? [driver.data.first_name, driver.data.last_name].filter(Boolean).join(" ")
          : null,
      ].filter(Boolean);

      return {
        ...base,
        summary: `Assign ${crew.join(" and ") || "crew"} to ${
          trip.data ? `${trip.data.pickup_location} → ${trip.data.destination}` : "this trip"
        }`,
      };
    }

    case "setTripStatus": {
      const parsed = setTripStatusArgs.safeParse(args);
      if (!parsed.success) break;
      const { data } = await supabase
        .from("trips")
        .select("pickup_location, destination")
        .eq("id", parsed.data.tripId)
        .maybeSingle();

      const labels: Record<string, string> = {
        SCHEDULED: "Scheduled",
        CONFIRMED: "Confirmed",
        DISPATCHED: "Dispatched",
        IN_PROGRESS: "Under way",
        COMPLETED: "Completed",
        CANCELLED: "Cancelled",
      };

      return {
        ...base,
        summary: `Move ${
          data ? `${data.pickup_location} → ${data.destination}` : "this trip"
        } to ${labels[parsed.data.status]}`,
        caution:
          parsed.data.status === "CANCELLED"
            ? "Cancelling releases the assigned vehicle and driver."
            : undefined,
      };
    }

    case "createCustomer": {
      const parsed = createCustomerArgs.safeParse(args);
      if (!parsed.success) break;
      const name = [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ");
      return {
        ...base,
        summary: `Add ${name}${parsed.data.company ? ` (${parsed.data.company})` : ""} as a customer`,
      };
    }

    case "createTripRequest": {
      const parsed = createTripRequestArgs.safeParse(args);
      if (!parsed.success) break;
      return {
        ...base,
        summary: `Log a request: ${parsed.data.pickupLocation} → ${parsed.data.destination}, ${parsed.data.passengerCount} passengers, departing ${parsed.data.departureAt}`,
        caution: "Creates a request only. Nothing is priced or booked.",
      };
    }
  }

  return { ...base, summary: `Run ${name}`, caution: "Check the details before confirming." };
}

/**
 * Execute a confirmed action.
 *
 * Runs on the operator's request-scoped client, so RLS still applies and the
 * role checks below are about giving a clear message rather than being the
 * boundary.
 */
export async function executeAction(
  name: ActionName,
  rawArgs: unknown,
  session: Session,
): Promise<ActionResult> {
  const schema = ACTION_SCHEMAS[name];
  const parsed = schema.safeParse(rawArgs);

  if (!parsed.success) {
    return { ok: false, message: "Those details did not validate, so nothing was changed." };
  }

  if (!canWrite(session.role)) {
    return { ok: false, message: "Your role does not allow making changes." };
  }

  const supabase = await createClient();
  const timeZone = session.organization.timezone;

  switch (name) {
    case "acceptTripRequest": {
      const { tripRequestId } = parsed.data as z.infer<typeof acceptTripRequestArgs>;

      const { data: request } = await supabase
        .from("trip_requests")
        .select("*")
        .eq("id", tripRequestId)
        .maybeSingle();

      if (!request) return { ok: false, message: "That request could not be found." };
      if (request.status === "ACCEPTED") {
        return { ok: false, message: "That request was already accepted." };
      }

      const { data: existing } = await supabase
        .from("trips")
        .select("id")
        .eq("trip_request_id", request.id)
        .maybeSingle();

      let tripId = existing?.id ?? null;

      if (!tripId) {
        const { data: trip, error } = await supabase
          .from("trips")
          .insert({
            organization_id: session.organization.id,
            trip_request_id: request.id,
            customer_id: request.customer_id,
            pickup_location: request.pickup_location,
            destination: request.destination,
            departure_at: request.departure_at,
            return_at: request.return_at,
            passenger_count: request.passenger_count,
            status: "SCHEDULED",
            notes: request.special_requirements,
          })
          .select("id")
          .single();

        if (error) return { ok: false, message: "Could not create the trip." };
        tripId = trip.id;
      }

      await supabase
        .from("trip_requests")
        .update({ status: "ACCEPTED" })
        .eq("id", request.id);

      return {
        ok: true,
        message: `Accepted ${request.reference ?? "the request"}. The trip is on your schedule.`,
        href: `/trips/${tripId}`,
      };
    }

    case "setTripRequestStatus": {
      const args = parsed.data as z.infer<typeof setTripRequestStatusArgs>;

      const { data: current } = await supabase
        .from("trip_requests")
        .select("notes, reference")
        .eq("id", args.tripRequestId)
        .maybeSingle();

      if (!current) return { ok: false, message: "That request could not be found." };

      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const notes = args.note
        ? `${current.notes ? `${current.notes}\n` : ""}[${stamp} UTC] ${args.note}`
        : current.notes;

      const { error } = await supabase
        .from("trip_requests")
        .update({ status: args.status, notes })
        .eq("id", args.tripRequestId);

      if (error) return { ok: false, message: "Could not update that request." };

      return {
        ok: true,
        message: `${current.reference ?? "Request"} set to ${args.status.toLowerCase().replace(/_/g, " ")}.`,
        href: `/trip-requests/${args.tripRequestId}`,
      };
    }

    case "assignCrew": {
      const args = parsed.data as z.infer<typeof assignCrewArgs>;

      if (!args.vehicleId && !args.driverId) {
        return { ok: false, message: "Nothing to assign — pick a vehicle, a driver, or both." };
      }

      const { error } = await supabase.from("trip_assignments").insert({
        organization_id: session.organization.id,
        trip_id: args.tripId,
        vehicle_id: args.vehicleId ?? null,
        driver_id: args.driverId ?? null,
        role: "PRIMARY",
      });

      if (error) return { ok: false, message: "Could not create that assignment." };

      return { ok: true, message: "Crew assigned.", href: `/trips/${args.tripId}` };
    }

    case "setTripStatus": {
      const args = parsed.data as z.infer<typeof setTripStatusArgs>;

      const { error } = await supabase
        .from("trips")
        .update({ status: args.status })
        .eq("id", args.tripId);

      if (error) return { ok: false, message: "Could not update that trip." };

      return {
        ok: true,
        message: `Trip moved to ${args.status.toLowerCase().replace(/_/g, " ")}.`,
        href: `/trips/${args.tripId}`,
      };
    }

    case "createCustomer": {
      const args = parsed.data as z.infer<typeof createCustomerArgs>;

      const { error } = await supabase
        .from("customers")
        .insert({
          organization_id: session.organization.id,
          first_name: args.firstName,
          last_name: args.lastName ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          company: args.company ?? null,
        });

      if (error) {
        return {
          ok: false,
          message: "Could not add that customer — the email may already be in use.",
        };
      }

      return { ok: true, message: `Added ${args.firstName}.`, href: `/customers` };
    }

    case "createTripRequest": {
      const args = parsed.data as z.infer<typeof createTripRequestArgs>;

      const departureAt =
        zonedTimeToUtc(args.departureAt, timeZone) ??
        (Number.isNaN(Date.parse(args.departureAt)) ? null : new Date(args.departureAt).toISOString());

      if (!departureAt) return { ok: false, message: "Could not read that departure date." };

      const returnAt = args.returnAt
        ? (zonedTimeToUtc(args.returnAt, timeZone) ??
          (Number.isNaN(Date.parse(args.returnAt)) ? null : new Date(args.returnAt).toISOString()))
        : null;

      const { data, error } = await supabase
        .from("trip_requests")
        .insert({
          organization_id: session.organization.id,
          pickup_location: args.pickupLocation,
          destination: args.destination,
          departure_at: departureAt,
          return_at: returnAt,
          passenger_count: args.passengerCount,
          contact_name: args.contactName ?? null,
          contact_email: args.contactEmail ?? null,
          contact_phone: args.contactPhone ?? null,
          special_requirements: args.specialRequirements ?? null,
          source: "AI",
          status: "NEW",
        })
        .select("id, reference")
        .single();

      if (error) return { ok: false, message: "Could not log that request." };

      return {
        ok: true,
        message: `Logged ${data.reference}.`,
        href: `/trip-requests/${data.id}`,
      };
    }
  }

  return { ok: false, message: "Unknown action." };
}

/** Deleting and refunding are never delegated to the assistant. */
export const NEVER_DELEGATED = [
  "deleting anything",
  "issuing refunds",
  "changing prices on a sent quote",
  "emailing customers",
] as const;

export function canDelete(session: Session) {
  return canManage(session.role);
}
