"use server";

import { revalidatePath } from "next/cache";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { zonedTimeToUtc } from "@/lib/datetime";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, canWrite } from "@/lib/permissions";
import {
  declineRequestSchema,
  requestInformationSchema,
  setStatusSchema,
  tripRequestSchema,
} from "@/lib/validations/trip-request";
import { uuid } from "@/lib/validations/shared";

function revalidateRequests(id?: string) {
  revalidatePath("/trip-requests");
  if (id) revalidatePath(`/trip-requests/${id}`);
  revalidatePath("/dashboard");
}

/** Stamp an operator note onto the existing thread rather than overwriting it. */
function appendNote(existing: string | null, entry: string) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const line = `[${stamp} UTC] ${entry}`;
  return existing?.trim() ? `${existing.trim()}\n${line}` : line;
}

export async function createTripRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow creating trip requests.");
  }

  const parsed = tripRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  const timeZone = session.organization.timezone;

  // The form submits wall-clock time in the operator's timezone.
  const departureAt = zonedTimeToUtc(input.departure_at, timeZone);
  const returnAt = input.return_at ? zonedTimeToUtc(input.return_at, timeZone) : null;

  if (!departureAt) {
    return formError("That departure date could not be read.", {
      departure_at: ["Pick a valid date and time"],
    });
  }

  const { error } = await supabase.from("trip_requests").insert({
    organization_id: session.organization.id,
    customer_id: input.customer_id,
    pickup_location: input.pickup_location,
    pickup_address: input.pickup_address,
    destination: input.destination,
    destination_address: input.destination_address,
    departure_at: departureAt,
    return_at: returnAt,
    passenger_count: input.passenger_count,
    special_requirements: input.special_requirements,
    notes: input.notes,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    source: "DASHBOARD",
    status: "NEW",
  });

  if (error) return databaseError(error);

  revalidateRequests();
  return formSuccess();
}

export async function updateTripRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing trip requests.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That request could not be found.");

  const parsed = tripRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  const timeZone = session.organization.timezone;
  const departureAt = zonedTimeToUtc(input.departure_at, timeZone);
  const returnAt = input.return_at ? zonedTimeToUtc(input.return_at, timeZone) : null;

  if (!departureAt) {
    return formError("That departure date could not be read.", {
      departure_at: ["Pick a valid date and time"],
    });
  }

  const { error } = await supabase
    .from("trip_requests")
    .update({
      customer_id: input.customer_id,
      pickup_location: input.pickup_location,
      pickup_address: input.pickup_address,
      destination: input.destination,
      destination_address: input.destination_address,
      departure_at: departureAt,
      return_at: returnAt,
      passenger_count: input.passenger_count,
      special_requirements: input.special_requirements,
      notes: input.notes,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
    })
    .eq("id", id.data);

  if (error) return databaseError(error);

  revalidateRequests(id.data);
  return formSuccess();
}

export async function setTripRequestStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow changing request status.");
  }

  const parsed = setStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("trip_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return databaseError(error);

  revalidateRequests(parsed.data.id);
  return formSuccess();
}

export async function requestInformationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow changing request status.");
  }

  const parsed = requestInformationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { data: current } = await supabase
    .from("trip_requests")
    .select("notes")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await supabase
    .from("trip_requests")
    .update({
      status: "NEEDS_INFORMATION",
      notes: appendNote(
        current?.notes ?? null,
        `Asked customer: ${parsed.data.question}`,
      ),
    })
    .eq("id", parsed.data.id);

  if (error) return databaseError(error);

  revalidateRequests(parsed.data.id);
  return formSuccess("Marked as awaiting the customer.");
}

export async function declineTripRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow declining requests.");
  }

  const parsed = declineRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { data: current } = await supabase
    .from("trip_requests")
    .select("notes")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await supabase
    .from("trip_requests")
    .update({
      status: "DECLINED",
      notes: appendNote(current?.notes ?? null, `Declined: ${parsed.data.reason}`),
    })
    .eq("id", parsed.data.id);

  if (error) return databaseError(error);

  revalidateRequests(parsed.data.id);
  return formSuccess("Request declined.");
}

/**
 * Accepting turns the request into a real trip on the schedule.
 *
 * Two writes, and the second can fail independently — Postgres has no
 * multi-statement transaction over PostgREST. The trip is created first so a
 * failure leaves the request still open and actionable, rather than an
 * accepted request with nothing on the schedule.
 */
export async function acceptTripRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow accepting requests.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That request could not be found.");

  const { data: request, error: readError } = await supabase
    .from("trip_requests")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();

  if (readError) return databaseError(readError);
  if (!request) return formError("That request could not be found.");

  if (request.status === "ACCEPTED") {
    return formError("That request has already been accepted.");
  }
  if (request.status === "DECLINED") {
    return formError("Reopen the request before accepting it.");
  }

  const { data: existingTrip } = await supabase
    .from("trips")
    .select("id")
    .eq("trip_request_id", request.id)
    .maybeSingle();

  if (!existingTrip) {
    const { error: tripError } = await supabase.from("trips").insert({
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
    });

    if (tripError) return databaseError(tripError);
  }

  const { error: statusError } = await supabase
    .from("trip_requests")
    .update({ status: "ACCEPTED" })
    .eq("id", request.id);

  if (statusError) {
    return formError(
      "The trip was created, but the request status did not update. Refresh and try again.",
    );
  }

  revalidateRequests(request.id);
  revalidatePath("/trips");
  return formSuccess("Accepted. The trip is on your schedule.");
}

export async function deleteTripRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete trip requests.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That request could not be found.");

  const { error } = await supabase.from("trip_requests").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidateRequests();
  return formSuccess();
}
