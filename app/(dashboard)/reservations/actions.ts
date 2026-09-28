"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { zonedTimeToUtc } from "@/lib/datetime";
import { RESERVATION_TIMES } from "@/lib/reservation-times";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, canWrite } from "@/lib/permissions";
import { getFleetAvailability } from "@/lib/queries/availability";
import type { createClient } from "@/lib/supabase/server";
import { uuid, type ActionResult } from "@/lib/validations/shared";
import {
  assignmentSchema,
  reservationUpdateSchema,
  tripStatusSchema,
} from "@/lib/validations/trip";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Trip states that hold a vehicle for their window. */
const BLOCKING_TRIP_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
] as const;

function revalidateTrip(id: string) {
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/dispatch");
  revalidatePath("/vehicles");
  revalidatePath("/reports");
}

/**
 * Keep vehicle.status in step with what the schedule actually says.
 *
 * Only ever moves between AVAILABLE and ASSIGNED. MAINTENANCE and INACTIVE are
 * decisions about the vehicle itself, so assigning work must never silently
 * overwrite them — a coach in the workshop stays in the workshop.
 *
 * Driver status is deliberately left alone: ON_TRIP means "driving right now",
 * not "booked for next month", so it belongs to dispatch, not to assignment.
 */
async function syncVehicleStatus(supabase: Supabase, vehicleId: string) {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, status")
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicle) return;
  if (vehicle.status !== "AVAILABLE" && vehicle.status !== "ASSIGNED") return;

  const { data: assignments } = await supabase
    .from("trip_assignments")
    .select("trip_id")
    .eq("vehicle_id", vehicleId);

  const tripIds = (assignments ?? []).map((row) => row.trip_id);

  let stillCommitted = false;
  if (tripIds.length > 0) {
    const { count } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .in("id", tripIds)
      .in("status", [...BLOCKING_TRIP_STATUSES]);

    stillCommitted = (count ?? 0) > 0;
  }

  const next = stillCommitted ? "ASSIGNED" : "AVAILABLE";
  if (next !== vehicle.status) {
    await supabase.from("vehicles").update({ status: next }).eq("id", vehicleId);
  }
}

export async function assignToTripAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow assigning vehicles or drivers.");
  }

  const parsed = assignmentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;

  const { data: trip } = await supabase
    .from("trips")
    .select("id, departure_at, return_at, passenger_count, status")
    .eq("id", input.trip_id)
    .maybeSingle();

  if (!trip) return formError("That trip could not be found.");
  if (trip.status === "CANCELLED" || trip.status === "COMPLETED") {
    return formError("This trip is closed, so its assignments are locked.");
  }

  // Re-check conflicts server-side. The form only offered free resources, but
  // another dispatcher may have taken one since the page rendered.
  const availability = await getFleetAvailability(trip, { excludeTripId: trip.id });

  if (input.vehicle_id) {
    const entry = availability.vehicles.find(
      (candidate) => candidate.vehicle.id === input.vehicle_id,
    );
    if (!entry) return formError("That vehicle is no longer in your fleet.");
    if (!entry.available) {
      return formError(
        `That vehicle is not available — ${entry.reason?.toLowerCase()}.`,
      );
    }
  }

  if (input.driver_id) {
    const entry = availability.drivers.find(
      (candidate) => candidate.driver.id === input.driver_id,
    );
    if (!entry) return formError("That driver is no longer on your roster.");
    if (!entry.available) {
      return formError(
        `That driver is not available — ${entry.reason?.toLowerCase()}.`,
      );
    }
  }

  const row = {
    vehicle_id: input.vehicle_id,
    driver_id: input.driver_id,
    role: input.role,
    notes: input.notes,
  };

  // A reservation converted from a quote carries one empty row per coach the
  // quote sold — that is what the board draws as unassigned. Assigning fills
  // the first of those before adding another, so the operator is not left
  // deleting a hollow "No vehicle, No driver" line afterwards.
  const { data: openSlot } = await supabase
    .from("trip_assignments")
    .select("id")
    .eq("trip_id", input.trip_id)
    .is("vehicle_id", null)
    .is("driver_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = openSlot
    ? await supabase.from("trip_assignments").update(row).eq("id", openSlot.id)
    : await supabase.from("trip_assignments").insert({
        organization_id: session.organization.id,
        trip_id: input.trip_id,
        ...row,
      });

  if (error) return databaseError(error);

  if (input.vehicle_id) await syncVehicleStatus(supabase, input.vehicle_id);

  revalidateTrip(input.trip_id);
  return formSuccess("Assignment added.");
}

export async function removeAssignmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow changing assignments.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That assignment could not be found.");

  const { data: assignment } = await supabase
    .from("trip_assignments")
    .select("id, trip_id, vehicle_id")
    .eq("id", id.data)
    .maybeSingle();

  if (!assignment) return formError("That assignment could not be found.");

  const { error } = await supabase.from("trip_assignments").delete().eq("id", id.data);

  if (error) return databaseError(error);

  if (assignment.vehicle_id) {
    await syncVehicleStatus(supabase, assignment.vehicle_id);
  }

  revalidateTrip(assignment.trip_id);
  return formSuccess();
}

export async function setTripStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow changing trip status.");
  }

  const parsed = tripStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { id, status } = parsed.data;

  // Dispatching an unstaffed trip is the mistake this screen exists to prevent,
  // so it is blocked here rather than merely discouraged in the interface.
  if (status === "DISPATCHED" || status === "IN_PROGRESS") {
    const { data: assignments } = await supabase
      .from("trip_assignments")
      .select("driver_id, vehicle_id")
      .eq("trip_id", id);

    const rows = assignments ?? [];
    if (!rows.some((row) => row.driver_id !== null)) {
      return formError("Assign a driver before dispatching this trip.");
    }
    if (!rows.some((row) => row.vehicle_id !== null)) {
      return formError("Assign a vehicle before dispatching this trip.");
    }
  }

  const { error } = await supabase.from("trips").update({ status }).eq("id", id);

  if (error) return databaseError(error);

  // Closing a trip frees its coaches.
  if (status === "COMPLETED" || status === "CANCELLED") {
    const { data: assignments } = await supabase
      .from("trip_assignments")
      .select("vehicle_id")
      .eq("trip_id", id);

    for (const row of assignments ?? []) {
      if (row.vehicle_id) await syncVehicleStatus(supabase, row.vehicle_id);
    }
  }

  revalidateTrip(id);
  return formSuccess("Trip updated.");
}

export async function deleteTripAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete trips.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That trip could not be found.");

  const { data: assignments } = await supabase
    .from("trip_assignments")
    .select("vehicle_id")
    .eq("trip_id", id.data);

  const vehicleIds = (assignments ?? [])
    .map((row) => row.vehicle_id)
    .filter((value): value is string => value !== null);

  const { error } = await supabase.from("trips").delete().eq("id", id.data);

  if (error) return databaseError(error);

  for (const vehicleId of vehicleIds) {
    await syncVehicleStatus(supabase, vehicleId);
  }

  revalidatePath("/reservations");
  revalidatePath("/vehicles");
  revalidatePath("/reports");
  return formSuccess();
}

const stopNotesSchema = z.object({
  id: uuid,
  notes: z.string().trim().max(2000),
});

/**
 * A note against one stop on a reservation.
 *
 * Kept on the stop rather than in the trip's single notes field, because the
 * things worth writing down are location-specific — which gate, which dock, who
 * to ask for — and a driver reading one long note has to work out which bit
 * applies to where they currently are.
 */
export async function setStopNotesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing this reservation.");
  }

  const parsed = stopNotesSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { data: stop, error } = await supabase
    .from("trip_stops")
    .update({ notes: parsed.data.notes || null })
    .eq("id", parsed.data.id)
    .select("trip_id")
    .maybeSingle();

  if (error) return databaseError(error);
  if (stop) revalidateTrip(stop.trip_id);

  return formSuccess("Note saved.");
}

/**
 * The reservation's own facts: its name, head count, route ends, the five
 * times of the run and its notes.
 *
 * Moving the times re-checks the coaches and drivers already on the job, for
 * the same reason assigning does — a trip slid into Saturday must not quietly
 * double-book a coach that was free on Friday.
 */
export async function updateReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing this reservation.");
  }

  const parsed = reservationUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  const timeZone = session.organization.timezone;

  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, departure_at, return_at, pickup_location, destination")
    .eq("id", input.id)
    .maybeSingle();

  if (!trip) return formError("That reservation could not be found.");
  if (trip.status === "CANCELLED" || trip.status === "COMPLETED") {
    return formError("This reservation is closed, so it can no longer be edited.");
  }

  // The form submits wall-clock time in the operator's timezone.
  const times: Record<string, string | null> = {};
  for (const { key } of RESERVATION_TIMES) {
    const value = input[key];
    if (value === null) {
      times[key] = null;
      continue;
    }
    const utc = zonedTimeToUtc(value, timeZone);
    if (!utc) return formError("Check the highlighted fields and try again.", {
      [key]: ["Pick a valid date and time"],
    });
    times[key] = utc;
  }
  const departureAt = times.departure_at as string;

  const timesMoved =
    departureAt !== new Date(trip.departure_at).toISOString() ||
    (times.return_at ?? null) !==
      (trip.return_at ? new Date(trip.return_at).toISOString() : null);

  if (timesMoved) {
    const { data: assignments } = await supabase
      .from("trip_assignments")
      .select("vehicle_id, driver_id")
      .eq("trip_id", trip.id);

    const rows = assignments ?? [];
    if (rows.some((row) => row.vehicle_id || row.driver_id)) {
      const availability = await getFleetAvailability(
        {
          departure_at: departureAt,
          return_at: times.return_at ?? null,
          passenger_count: input.passenger_count,
        },
        { excludeTripId: trip.id },
      );

      for (const row of rows) {
        const vehicle = availability.vehicles.find(
          (entry) => entry.vehicle.id === row.vehicle_id,
        );
        if (vehicle && vehicle.reason === "On another trip these dates") {
          return formError(
            `${vehicle.vehicle.name} is on another trip at the new times. Unassign it first, or pick different times.`,
          );
        }
        const driver = availability.drivers.find(
          (entry) => entry.driver.id === row.driver_id,
        );
        // Only the date-driven reasons: leave or retirement is not something
        // moving the trip caused, and the assignment panel already shows it.
        const statusReason =
          driver?.driver.status === "INACTIVE" || driver?.driver.status === "ON_LEAVE";
        if (driver && !driver.available && !statusReason) {
          const name = [driver.driver.first_name, driver.driver.last_name]
            .filter(Boolean)
            .join(" ");
          return formError(
            `${name} is not available at the new times — ${driver.reason?.toLowerCase()}.`,
          );
        }
      }
    }
  }

  // A picked suggestion brings its point with it. A retyped address no longer
  // sits where its old pin did, so that pin goes; an untouched one keeps it.
  const place = (
    typed: string,
    stored: string,
    lat: number | null,
    lng: number | null,
  ) => {
    if (lat !== null && lng !== null) return { lat, lng };
    if (typed !== stored) return { lat: null, lng: null };
    return null;
  };
  const pickup = place(
    input.pickup_location,
    trip.pickup_location,
    input.pickup_lat,
    input.pickup_lng,
  );
  const destination = place(
    input.destination,
    trip.destination,
    input.destination_lat,
    input.destination_lng,
  );

  const { error } = await supabase
    .from("trips")
    .update({
      group_name: input.group_name,
      passenger_count: input.passenger_count,
      pickup_location: input.pickup_location,
      destination: input.destination,
      garage_arrival_at: times.garage_arrival_at,
      spot_at: times.spot_at,
      departure_at: departureAt,
      dropoff_at: times.dropoff_at,
      return_at: times.return_at,
      notes: input.notes,
      last_activity_at: new Date().toISOString(),
      ...(pickup && { pickup_lat: pickup.lat, pickup_lng: pickup.lng }),
      ...(destination && {
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      }),
    })
    .eq("id", trip.id);

  if (error) return databaseError(error);

  revalidateTrip(trip.id);
  revalidatePath("/board");
  revalidatePath("/dispatch");
  return formSuccess("Reservation updated.");
}

export type AssignmentOption = { id: string; label: string; detail: string };

/**
 * The coaches and drivers free for one trip's window, for picking one without
 * leaving the dispatch board. Same rule as the reservation page: in service,
 * not on an overlapping trip, and for drivers no time off and a valid licence.
 * Whoever is already on this trip is left out — they are shown as the current
 * value, not offered a second time.
 */
export async function assignmentOptionsAction(
  tripId: string,
): Promise<ActionResult<{ vehicles: AssignmentOption[]; drivers: AssignmentOption[] }>> {
  const { session, supabase } = await actionContext();
  if (!canWrite(session.role)) {
    return { ok: false, message: "Your role does not allow changing assignments." };
  }

  const id = uuid.safeParse(tripId);
  if (!id.success) return { ok: false, message: "That trip could not be found." };

  const [{ data: trip }, { data: rows }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, departure_at, return_at, passenger_count")
      .eq("id", id.data)
      .maybeSingle(),
    supabase.from("trip_assignments").select("vehicle_id, driver_id").eq("trip_id", id.data),
  ]);
  if (!trip) return { ok: false, message: "That trip could not be found." };

  const availability = await getFleetAvailability(trip, { excludeTripId: trip.id });
  const onTrip = new Set((rows ?? []).flatMap((row) => [row.vehicle_id, row.driver_id]));

  return {
    ok: true,
    data: {
      vehicles: availability.vehicles
        .filter((entry) => entry.available && !onTrip.has(entry.vehicle.id))
        .map((entry) => ({
          id: entry.vehicle.id,
          label: entry.vehicle.name,
          detail: `${entry.vehicle.capacity} seats`,
        })),
      drivers: availability.drivers
        .filter((entry) => entry.available && !onTrip.has(entry.driver.id))
        .map((entry) => ({
          id: entry.driver.id,
          label: [entry.driver.first_name, entry.driver.last_name].filter(Boolean).join(" "),
          detail: entry.driver.phone ?? "",
        })),
    },
  };
}

const assignmentPartSchema = z.object({
  assignment_id: uuid,
  field: z.enum(["vehicle_id", "driver_id"]),
  value: uuid.nullable(),
});

/**
 * Puts a coach or a driver on one existing assignment row, or takes one off.
 *
 * Filling the row in place matters: a converted quote arrives with one empty
 * row per coach it sold, and a coach assigned without its driver is a row half
 * filled. Adding a second row for the driver would draw that one job as two
 * crews. Availability is checked again here for the same reason as when
 * assigning — another dispatcher may have taken the driver since the list was
 * fetched.
 */
export async function setAssignmentPartAction(input: {
  assignment_id: string;
  field: "vehicle_id" | "driver_id";
  value: string | null;
}): Promise<ActionResult> {
  const { session, supabase } = await actionContext();
  if (!canWrite(session.role)) {
    return { ok: false, message: "Your role does not allow changing assignments." };
  }

  const parsed = assignmentPartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That assignment could not be updated." };
  const { assignment_id, field, value } = parsed.data;

  const { data: row } = await supabase
    .from("trip_assignments")
    .select("id, trip_id, vehicle_id, driver_id, trips(id, status, departure_at, return_at, passenger_count)")
    .eq("id", assignment_id)
    .maybeSingle();

  const trip = row?.trips as
    | { id: string; status: string; departure_at: string; return_at: string | null; passenger_count: number }
    | null
    | undefined;
  if (!row || !trip) return { ok: false, message: "That assignment could not be found." };
  if (trip.status === "CANCELLED" || trip.status === "COMPLETED") {
    return { ok: false, message: "This trip is closed, so its assignments are locked." };
  }

  if (value) {
    const availability = await getFleetAvailability(trip, { excludeTripId: trip.id });
    const entry =
      field === "vehicle_id"
        ? availability.vehicles.find((candidate) => candidate.vehicle.id === value)
        : availability.drivers.find((candidate) => candidate.driver.id === value);
    if (!entry) {
      return {
        ok: false,
        message:
          field === "vehicle_id"
            ? "That vehicle is no longer in your fleet."
            : "That driver is no longer on your roster.",
      };
    }
    if (!entry.available) {
      return {
        ok: false,
        message: `${field === "vehicle_id" ? "That vehicle" : "That driver"} is not available — ${entry.reason?.toLowerCase()}.`,
      };
    }
  }

  const previousVehicle = row.vehicle_id;
  const { error } = await supabase
    .from("trip_assignments")
    .update(field === "vehicle_id" ? { vehicle_id: value } : { driver_id: value })
    .eq("id", assignment_id);
  if (error) return { ok: false, message: error.message };

  if (field === "vehicle_id") {
    if (previousVehicle) await syncVehicleStatus(supabase, previousVehicle);
    if (value) await syncVehicleStatus(supabase, value);
  }

  revalidateTrip(trip.id);
  return { ok: true, data: undefined };
}
