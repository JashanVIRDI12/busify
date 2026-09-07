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
import { contactSchema } from "@/lib/validations/contact";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const DUPLICATE_EMAIL = {
  customers_org_email_unique: "Another contact already uses that email address.",
};

export async function createContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding contacts.");
  }

  const parsed = contactSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("customers").insert({
    // Never trust a client-supplied organization_id.
    organization_id: session.organization.id,
    ...parsed.data,
  });

  if (error) return databaseError(error, DUPLICATE_EMAIL);

  revalidatePath("/contacts");
  return formSuccess();
}

export async function updateContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing contacts.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That contact could not be found.");

  const parsed = contactSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  // No organization_id filter: RLS already limits this to the caller's tenant.
  const { error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_EMAIL);

  revalidatePath("/contacts");
  return formSuccess();
}

/**
 * Bulk delete from the selection bar. Deleting is a manager action, and a
 * contact attached to a quote or a reservation is nulled out there rather than
 * cascading — losing the booking because someone tidied the address book would
 * be the worse failure.
 */
export async function deleteContactsAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Your role does not allow deleting contacts." };
  }

  const parsed = uuid.array().max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidatePath("/contacts");
  return { ok: true, data: undefined };
}
