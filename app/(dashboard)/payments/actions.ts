"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext } from "@/lib/auth/guard";
import { firstNameOf, renderTemplate } from "@/lib/mail/render";
import { mailConfigured, sendMail, type Attachment } from "@/lib/mail/send";
import { renderQuotePdf, toBase64 } from "@/lib/pdf/quote-pdf";
import { canWriteFinance } from "@/lib/permissions";
import { getInvoicePdfData } from "@/lib/queries/invoice-pdf";
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

/**
 * Email the invoice for each selected reservation, then stamp it.
 *
 * Stamped only on success, and per reservation: a batch where the third
 * address bounces should leave the first two recorded as sent and say plainly
 * which one failed, rather than marking all five and losing the failure.
 */
export async function emailInvoicesAction(
  tripIds: string[],
): Promise<ActionResult<{ sent: number; delivered: boolean; skipped: string[] }>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow sending invoices." };
  }

  const parsed = uuid.array().min(1).max(50).safeParse(tripIds);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body, from_email, include_pdf")
    .eq("kind", "INVOICE")
    .maybeSingle();

  const organization = session.organization;
  const senderName =
    (typeof session.user.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : null) ?? organization.name;

  let sent = 0;
  const skipped: string[] = [];

  for (const tripId of parsed.data) {
    const { data: trip } = await supabase
      .from("trips")
      .select("id, reference, customers(first_name, email)")
      .eq("id", tripId)
      .maybeSingle();

    const label = trip?.reference ?? tripId.slice(0, 8);
    const email = trip?.customers?.email;

    if (!email) {
      skipped.push(`${label} (no email on the contact)`);
      continue;
    }

    const tokens = {
      CONTACT_FIRST_NAME: firstNameOf(trip?.customers?.first_name, email),
      SENDER_FULL_NAME: senderName,
      COMPANY_NAME: organization.email_sender_name ?? organization.name,
      QUOTE_LINK: null,
      RESERVATION_ID: trip?.reference ?? label,
    };

    let attachments: Attachment[] | undefined;
    if (template?.include_pdf !== false) {
      try {
        const data = await getInvoicePdfData(supabase, tripId);
        if (data) {
          attachments = [
            {
              filename: `${data.quote.reference}-invoice.pdf`,
              content: toBase64(await renderQuotePdf(data)),
              contentType: "application/pdf",
            },
          ];
        }
      } catch (error) {
        console.error("Invoice PDF failed; sending without it", error);
      }
    }

    const result = await sendMail({
      to: email,
      subject: renderTemplate(
        template?.subject?.trim() || `Invoice ${label} from ${organization.name}`,
        tokens,
      ),
      text: renderTemplate(
        template?.body?.trim() ||
          `Hi ${tokens.CONTACT_FIRST_NAME},\n\nYour invoice for reservation ${label} is attached.\n\nThanks,\n${senderName}`,
        tokens,
      ),
      replyTo: template?.from_email ?? organization.email,
      bcc: organization.bcc_email,
      attachments,
    });

    if (!result.ok) {
      skipped.push(`${label} (${result.message})`);
      continue;
    }

    await supabase
      .from("trips")
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq("id", tripId);

    sent += 1;
  }

  revalidatePath("/payments");
  revalidatePath("/reservations");

  if (sent === 0) {
    return {
      ok: false,
      message: skipped[0] ?? "No invoices could be sent.",
    };
  }

  return { ok: true, data: { sent, delivered: mailConfigured(), skipped } };
}

/** Stamps the invoice as sent without emailing — for invoices sent elsewhere. */
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
