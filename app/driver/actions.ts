"use server";

import { revalidatePath } from "next/cache";

import { requireDriver } from "@/lib/auth/session";
import { zonedTimeToUtc } from "@/lib/datetime";
import { databaseError } from "@/lib/auth/guard";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { unavailabilitySchema } from "@/lib/validations/availability";
import { uuid } from "@/lib/validations/shared";
import { tripStatusSchema } from "@/lib/validations/trip";
import type { TripStatus } from "@/types/database";

/**
 * What a driver may move a trip to from where it is now. Forward only — a
 * driver starts and finishes their trip; confirming and cancelling stay with
 * dispatch.
 */
const DRIVER_NEXT: Partial<Record<TripStatus, TripStatus>> = {
  CONFIRMED: "IN_PROGRESS",
  DISPATCHED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export async function setAssignedTripStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { driver } = await requireDriver();
  const supabase = await createClient();

  const parsed = tripStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { id, status } = parsed.data;

  // Confirm the trip is actually theirs and read its current status.
  const { data: assignment } = await supabase
    .from("trip_assignments")
    .select("trip_id")
    .eq("trip_id", id)
    .eq("driver_id", driver.id)
    .maybeSingle();
  if (!assignment) return formError("That trip is not assigned to you.");

  const { data: trip } = await supabase
    .from("trips")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!trip) return formError("That trip could not be found.");

  const allowed = DRIVER_NEXT[trip.status as TripStatus];
  if (status !== allowed) {
    return formError(
      allowed
        ? `From here you can only mark this trip "${allowed.replace("_", " ").toLowerCase()}".`
        : "There's nothing for you to update on this trip right now.",
    );
  }

  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", id);
  if (error) return databaseError(error);

  revalidatePath("/driver");
  revalidatePath(`/driver/trips/${id}`);
  return formSuccess("Trip updated.");
}

export async function addUnavailabilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { driver, organization } = await requireDriver();
  const supabase = await createClient();

  const parsed = unavailabilitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const startsAt = zonedTimeToUtc(parsed.data.starts_at, organization.timezone);
  const endsAt = zonedTimeToUtc(parsed.data.ends_at, organization.timezone);
  if (!startsAt || !endsAt) {
    return formError("Pick a valid date and time.");
  }

  const { error } = await supabase.from("driver_availability").insert({
    organization_id: organization.id,
    driver_id: driver.id,
    starts_at: startsAt,
    ends_at: endsAt,
    is_available: false,
    reason: parsed.data.reason,
  });
  if (error) return databaseError(error);

  revalidatePath("/driver/schedule");
  return formSuccess("Time blocked off.");
}

export async function removeUnavailabilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { driver } = await requireDriver();
  const supabase = await createClient();

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That entry could not be found.");

  const { error } = await supabase
    .from("driver_availability")
    .delete()
    .eq("id", id.data)
    .eq("driver_id", driver.id);
  if (error) return databaseError(error);

  revalidatePath("/driver/schedule");
  return formSuccess("Removed.");
}
