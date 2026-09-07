"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext } from "@/lib/auth/guard";
import { canWriteFinance } from "@/lib/permissions";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const paymentInput = z.object({
  trip_id: z.uuid(),
  amount: z.coerce.number<number>().min(0, "Enter an amount of zero or more"),
});

/**
 * Records what has been collected against a reservation.
 *
 * The payment *status* is derived from the numbers rather than chosen: an
 * operator who types the full amount has been paid, whatever a dropdown says,
 * and letting the two disagree is how a paid job ends up on a chase list.
 */
export async function recordPaymentAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow recording payments." };
  }

  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]!.message };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("total_due")
    .eq("id", parsed.data.trip_id)
    .maybeSingle();

  if (!trip) return { ok: false, message: "That reservation was not found." };

  const paid = Number(parsed.data.amount.toFixed(2));
  const due = Number(trip.total_due);

  const status =
    paid <= 0 ? "UNPAID" : paid >= due ? "PAID" : ("PARTIAL" as const);

  const { error } = await supabase
    .from("trips")
    .update({ amount_paid: paid, payment_status: status })
    .eq("id", parsed.data.trip_id);

  if (error) {
    return { ok: false, message: "That payment could not be recorded." };
  }

  revalidatePath("/payments");
  revalidatePath("/reservations");
  return { ok: true, data: undefined };
}

/** Stamps the invoice as sent, which is what the reservations list reports. */
export async function markInvoicesSentAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow sending invoices." };
  }

  const parsed = uuid.array().min(1).max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase
    .from("trips")
    .update({ invoice_sent_at: new Date().toISOString() })
    .in("id", parsed.data);

  if (error) {
    return { ok: false, message: "Those invoices could not be marked as sent." };
  }

  revalidatePath("/payments");
  revalidatePath("/reservations");
  return { ok: true, data: undefined };
}
