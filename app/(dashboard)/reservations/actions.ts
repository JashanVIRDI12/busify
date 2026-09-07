"use server";

import { revalidatePath } from "next/cache";

import { actionContext, databaseError } from "@/lib/auth/guard";
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
import { uuid } from "@/lib/validations/shared";
import { assignmentSchema, tripStatusSchema } from "@/lib/validations/trip";

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
  revalidatePath(`/trips/${id}`);
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
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

  const { error } = await supabase.from("trip_assignments").insert({
    organization_id: session.organization.id,
    trip_id: input.trip_id,
    vehicle_id: input.vehicle_id,
    driver_id: input.driver_id,
    role: input.role,
    notes: input.notes,
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
  revalidatePath("/dashboard");
  return formSuccess();
}
