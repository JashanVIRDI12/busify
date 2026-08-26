"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionContext, databaseError } from "@/lib/auth/guard";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, canWriteFinance } from "@/lib/permissions";
import {
  priceQuote,
  suggestLines,
  toMajor,
  toMinor,
  type QuoteLineInput,
} from "@/lib/pricing";
import { quoteDraftSchema, quoteStatusSchema } from "@/lib/validations/quote";
import { uuid } from "@/lib/validations/shared";

function revalidateQuote(id?: string) {
  revalidatePath("/quotes");
  if (id) revalidatePath(`/quotes/${id}`);
  revalidatePath("/trip-requests");
  revalidatePath("/dashboard");
}

/**
 * Build a quote from the operator's pricing inputs.
 *
 * Totals are computed here, never accepted from the form. lib/pricing is
 * deterministic and works in integer minor units; the only conversion to
 * `numeric(12,2)` happens at the insert.
 */
export async function createQuoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return formError("Your role does not allow creating quotes.");
  }

  const parsed = quoteDraftSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;

  let lines: QuoteLineInput[] = [];

  if (input.vehicle_type_id) {
    const { data: vehicleType } = await supabase
      .from("vehicle_types")
      .select("name, base_rate, per_km_rate, per_hour_rate")
      .eq("id", input.vehicle_type_id)
      .maybeSingle();

    if (!vehicleType) return formError("That vehicle type could not be found.");

    lines = suggestLines({
      vehicleType,
      vehicleCount: input.vehicle_count,
      distanceKm: input.distance_km,
      durationHours: input.duration_hours,
    });
  }

  if (input.extra_fuel > 0) {
    lines.push({
      kind: "FUEL",
      description: "Fuel surcharge",
      quantity: 1,
      unitPrice: toMinor(input.extra_fuel),
    });
  }
  if (input.extra_tolls > 0) {
    lines.push({
      kind: "TOLLS",
      description: "Tolls and permits",
      quantity: 1,
      unitPrice: toMinor(input.extra_tolls),
    });
  }
  if (input.extra_services > 0) {
    lines.push({
      kind: "ADDITIONAL_SERVICE",
      description: input.extra_services_label ?? "Additional services",
      quantity: 1,
      unitPrice: toMinor(input.extra_services),
    });
  }

  if (lines.length === 0) {
    return formError(
      "This quote has no charges. Pick a vehicle type with rates, or add a fuel, toll or service amount.",
    );
  }

  const priced = priceQuote({
    lines,
    discount: toMinor(input.discount),
    taxRatePercent: input.tax_rate_percent,
    depositPercent: input.deposit_percent,
  });

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      organization_id: session.organization.id,
      trip_request_id: input.trip_request_id,
      customer_id: input.customer_id,
      subtotal: toMajor(priced.subtotal),
      tax: toMajor(priced.tax),
      tax_rate_percent: input.tax_rate_percent,
      tax_province: input.tax_province,
      discount: toMajor(priced.discount),
      total: toMajor(priced.total),
      deposit_amount: toMajor(priced.deposit),
      currency: session.organization.currency,
      valid_until: input.valid_until,
      notes: input.notes,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error) return databaseError(error);

  const { error: itemsError } = await supabase.from("quote_items").insert(
    priced.lines.map((line, index) => ({
      organization_id: session.organization.id,
      quote_id: quote.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit_price: toMajor(line.unitPrice),
      amount: toMajor(line.amount),
      position: index,
    })),
  );

  if (itemsError) {
    // A quote with no lines is worse than no quote — roll it back by hand,
    // since PostgREST gives us no multi-statement transaction.
    await supabase.from("quotes").delete().eq("id", quote.id);
    return databaseError(itemsError);
  }

  // Mark the source request as quoted so it leaves the operator's queue.
  if (input.trip_request_id) {
    await supabase
      .from("trip_requests")
      .update({ status: "QUOTED" })
      .eq("id", input.trip_request_id);
  }

  revalidateQuote(quote.id);
  redirect(`/quotes/${quote.id}`);
}

export async function sendQuoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return formError("Your role does not allow sending quotes.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That quote could not be found.");

  const { error } = await supabase
    .from("quotes")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", id.data);

  if (error) return databaseError(error);

  revalidateQuote(id.data);
  return formSuccess("Quote marked as sent. Share the customer link to deliver it.");
}

export async function setQuoteStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return formError("Your role does not allow changing quotes.");
  }

  const parsed = quoteStatusSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("quotes")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return databaseError(error);

  revalidateQuote(parsed.data.id);
  return formSuccess("Quote updated.");
}

export async function deleteQuoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete quotes.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That quote could not be found.");

  const { error } = await supabase.from("quotes").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidateQuote();
  return formSuccess();
}
