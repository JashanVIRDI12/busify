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
import { customerSchema } from "@/lib/validations/customer";
import { uuid } from "@/lib/validations/shared";

const DUPLICATE_EMAIL = {
  customers_org_email_unique: "Another customer already uses that email address.",
};

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding customers.");
  }

  const parsed = customerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("customers").insert({
    // Never trust a client-supplied organization_id.
    organization_id: session.organization.id,
    ...parsed.data,
  });

  if (error) return databaseError(error, DUPLICATE_EMAIL);

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return formSuccess();
}

export async function updateCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing customers.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That customer could not be found.");

  const parsed = customerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  // No organization_id filter: RLS already limits this to the caller's tenant.
  const { error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_EMAIL);

  revalidatePath("/customers");
  return formSuccess();
}

export async function deleteCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete customers.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That customer could not be found.");

  const { error } = await supabase.from("customers").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return formSuccess();
}
