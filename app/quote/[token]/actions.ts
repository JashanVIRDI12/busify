"use server";

import { revalidatePath } from "next/cache";

import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { convertQuoteToReservations } from "@/lib/quotes/convert";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicQuoteResponseSchema } from "@/lib/validations/quote";

/**
 * Record that a customer has opened their quote.
 *
 * Fire-and-forget from the page render, and deliberately silent on failure —
 * a broken analytics write must never stop a customer seeing their price.
 */
export async function markQuoteViewed(token: string) {
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, viewed_at")
    .eq("public_token", token)
    .maybeSingle();

  if (!quote || quote.status !== "SENT") return;

  await supabase
    .from("quotes")
    .update({ status: "VIEWED", viewed_at: quote.viewed_at ?? new Date().toISOString() })
    .eq("id", quote.id);
}

/**
 * The customer's decision on their quote.
 *
 * Anonymous, so it runs on the service-role client with the quote resolved
 * from the opaque token. The token is the only credential — which is why it is
 * a random uuid separate from the row id, and why drafts are unreachable.
 *
 * Accepting creates the booking and the trip together. That is the one place
 * money and operations meet, so it is done here rather than left to the
 * operator to remember.
 */
export async function respondToQuoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = publicQuoteResponseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { token, decision, message } = parsed.data;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!quote) return formError("This quote is no longer available.");
  if (quote.status === "DRAFT") return formError("This quote is not ready yet.");

  if (quote.status === "ACCEPTED" || quote.status === "DECLINED") {
    return formError("You have already responded to this quote.");
  }

  if (
    quote.valid_until &&
    new Date(`${quote.valid_until}T23:59:59Z`) < new Date()
  ) {
    return formError(
      "This quote has expired. Contact the operator and they can reissue it.",
    );
  }

  const respondedAt = new Date().toISOString();

  if (decision === "DECLINED") {
    await supabase
      .from("quotes")
      .update({
        status: "DECLINED",
        responded_at: respondedAt,
        notes: message
          ? `${quote.notes ? `${quote.notes}\n` : ""}Customer declined: ${message}`
          : quote.notes,
      })
      .eq("id", quote.id);

    revalidatePath("/quotes");
    revalidatePath("/reports");
    return formSuccess("Thanks — we have let the operator know.");
  }

  // --- Accepted ------------------------------------------------------------
  // Create the reservations first: if the booking insert then fails, the
  // operator has work on the schedule rather than a paid booking with nothing
  // behind it.
  //
  // Every accepted quote converts, whatever it came from. Previously only a
  // quote seeded from a trip request produced a reservation, so a quote built
  // in the builder — the normal path — was accepted into nothing and never
  // reached the dispatch board.
  const { data: organization } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", quote.organization_id)
    .maybeSingle();

  const conversion = await convertQuoteToReservations(
    supabase,
    quote.id,
    organization?.timezone ?? "America/Toronto",
  );

  if (!conversion.ok) {
    console.error("Quote accept: conversion failed", conversion.message);
    return formError(
      "We could not confirm your booking. Please contact the operator directly.",
    );
  }

  const tripId = conversion.tripIds[0] ?? null;

  if (quote.trip_request_id) {
    await supabase
      .from("trip_requests")
      .update({ status: "ACCEPTED" })
      .eq("id", quote.trip_request_id);
  }

  const total = Number(quote.total);
  const deposit = Number(quote.deposit_amount);

  const { error: bookingError } = await supabase.from("bookings").insert({
    organization_id: quote.organization_id,
    quote_id: quote.id,
    trip_id: tripId,
    customer_id: quote.customer_id,
    status: "PENDING_PAYMENT",
    total_amount: total,
    deposit_amount: deposit,
    balance_amount: Math.max(total - deposit, 0),
    currency: quote.currency,
  });

  if (bookingError) {
    console.error("Quote accept: booking creation failed", bookingError);
    return formError(
      "We could not confirm your booking. Please contact the operator directly.",
    );
  }

  await supabase
    .from("quotes")
    .update({
      status: "ACCEPTED",
      pipeline_status: "WON",
      responded_at: respondedAt,
      notes: message
        ? `${quote.notes ? `${quote.notes}\n` : ""}Customer note: ${message}`
        : quote.notes,
    })
    .eq("id", quote.id);

  revalidatePath("/quotes");
  revalidatePath("/bookings");
  revalidatePath("/reservations");
  revalidatePath("/reports");

  return formSuccess("Accepted — your booking is confirmed with the operator.");
}
