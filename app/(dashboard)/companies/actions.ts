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
import { companySchema } from "@/lib/validations/contact";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/** Groups arrive as repeated form fields rather than one comma-joined value. */
function readGroups(formData: FormData): string[] {
  return formData
    .getAll("groups")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function createCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding companies.");
  }

  const parsed = companySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("companies").insert({
    organization_id: session.organization.id,
    ...parsed.data,
    groups: readGroups(formData),
  });

  if (error) return databaseError(error);

  revalidatePath("/companies");
  revalidatePath("/contacts");
  return formSuccess();
}

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing companies.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That company could not be found.");

  const parsed = companySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("companies")
    .update({ ...parsed.data, groups: readGroups(formData) })
    .eq("id", id.data);

  if (error) return databaseError(error);

  revalidatePath("/companies");
  revalidatePath("/contacts");
  return formSuccess();
}

export async function deleteCompaniesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Your role does not allow deleting companies." };
  }

  const parsed = uuid.array().max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  // Contacts, quotes and reservations pointing here are nulled out by the
  // foreign keys rather than deleted with the account.
  const { error } = await supabase.from("companies").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidatePath("/companies");
  revalidatePath("/contacts");
  return { ok: true, data: undefined };
}
