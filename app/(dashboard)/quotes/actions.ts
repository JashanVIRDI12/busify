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
import { canManage, canWriteFinance } from "@/lib/permissions";
import { quoteStatusSchema } from "@/lib/validations/quote";
import { uuid } from "@/lib/validations/shared";

function revalidateQuote(id?: string) {
  revalidatePath("/quotes");
  if (id) revalidatePath(`/quotes/${id}`);
  revalidatePath("/trip-requests");
  revalidatePath("/reports");
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
