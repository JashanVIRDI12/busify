"use server";

import { revalidatePath } from "next/cache";

import { actionContext } from "@/lib/auth/guard";
import { siteUrl } from "@/lib/env";
import { firstNameOf, renderTemplate } from "@/lib/mail/render";
import { mailConfigured, sendMail, type Attachment } from "@/lib/mail/send";
import { renderQuotePdf, toBase64 } from "@/lib/pdf/quote-pdf";
import { canWriteFinance } from "@/lib/permissions";
import { getQuotePdfData } from "@/lib/queries/quote-pdf";
import { uuid, type ActionResult } from "@/lib/validations/shared";

export type SendOutcome = { delivered: boolean; to: string };

/**
 * Email a quote to its booking contact.
 *
 * Sending and "marking as sent" were previously the same button, which meant
 * the operator had to copy the link and send it themselves from Outlook. This
 * renders the operator's own template, attaches the PDF if their template says
 * to, delivers it, and only then stamps the quote — so a quote is never
 * recorded as sent because a delivery failed.
 */
export async function emailQuoteAction(
  quoteId: string,
): Promise<ActionResult<SendOutcome>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow sending quotes." };
  }

  const id = uuid.safeParse(quoteId);
  if (!id.success) return { ok: false, message: "That quote could not be found." };

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, status, customer_id, public_token, expiry_days, expiry_anchor, first_sent_at, title",
    )
    .eq("id", id.data)
    .maybeSingle();

  if (!quote) return { ok: false, message: "That quote could not be found." };

  if (!quote.customer_id) {
    return {
      ok: false,
      message: "Add a booking contact on the Customer tab before sending.",
    };
  }

  const { data: contact } = await supabase
    .from("customers")
    .select("first_name, last_name, email")
    .eq("id", quote.customer_id)
    .maybeSingle();

  if (!contact?.email) {
    return {
      ok: false,
      message: "That contact has no email address. Add one and try again.",
    };
  }

  // A quote that has already been sent once is a follow-up, not a first send —
  // which is the template the operator wrote for a bookable quote.
  const kind = quote.first_sent_at ? "QUOTE_REQUEST" : "QUOTE_BOOKING";

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body, from_email, include_pdf")
    .eq("kind", kind)
    .maybeSingle();

  const organization = session.organization;
  const link = `${siteUrl()}/quote/${quote.public_token}`;

  const tokens = {
    CONTACT_FIRST_NAME: firstNameOf(contact.first_name, contact.email),
    SENDER_FULL_NAME:
      (typeof session.user.user_metadata?.full_name === "string"
        ? session.user.user_metadata.full_name
        : null) ??
      organization.name,
    COMPANY_NAME: organization.email_sender_name ?? organization.name,
    QUOTE_LINK: link,
    RESERVATION_ID: null,
  };

  const subject = renderTemplate(
    template?.subject?.trim() || `Your quote from ${organization.name}`,
    tokens,
  );

  const body = renderTemplate(
    template?.body?.trim() ||
      `Hi ${tokens.CONTACT_FIRST_NAME},\n\nHere is your quote.\n\n${link}\n\nThanks,\n${tokens.SENDER_FULL_NAME}`,
    tokens,
  );

  // The PDF is best-effort. A quote whose document fails to render should still
  // reach the customer with a working link.
  let attachments: Attachment[] | undefined;

  if (template?.include_pdf !== false) {
    try {
      const pdfData = await getQuotePdfData(supabase, id.data);
      if (pdfData) {
        attachments = [
          {
            filename: `${pdfData.quote.reference}.pdf`,
            content: toBase64(await renderQuotePdf(pdfData)),
            contentType: "application/pdf",
          },
        ];
      }
    } catch (error) {
      console.error("Quote PDF failed; sending without it", error);
    }
  }

  const sent = await sendMail({
    to: contact.email,
    subject,
    text: body,
    replyTo: template?.from_email ?? organization.email,
    bcc: organization.bcc_email,
    attachments,
  });

  if (!sent.ok) return { ok: false, message: sent.message };

  const now = new Date();
  const firstSentAt = quote.first_sent_at ?? now.toISOString();

  let validUntil: string | null = null;
  if (quote.expiry_days) {
    const anchor =
      quote.expiry_anchor === "FIRST_SENT" ? new Date(firstSentAt) : now;
    anchor.setDate(anchor.getDate() + quote.expiry_days);
    validUntil = anchor.toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "SENT",
      pipeline_status: "QUOTED",
      sent_at: now.toISOString(),
      first_sent_at: firstSentAt,
      valid_until: validUntil,
      expires_at: validUntil ? `${validUntil}T23:59:59.000Z` : null,
    })
    .eq("id", id.data);

  if (error) {
    // The customer has the email; failing here would be misleading.
    console.error("Quote sent but not stamped", error);
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id.data}`);

  return {
    ok: true,
    data: { delivered: sent.delivered && mailConfigured(), to: contact.email },
  };
}
