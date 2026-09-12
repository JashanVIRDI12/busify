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
import { driverSchema } from "@/lib/validations/driver";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const DUPLICATE_LICENSE = {
  drivers_org_license_unique:
    "Another driver already has that licence number.",
};

function revalidateDrivers() {
  revalidatePath("/drivers");
  revalidatePath("/reports");
}

export async function createDriverAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding drivers.");
  }

  const parsed = driverSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("drivers").insert({
    organization_id: session.organization.id,
    ...parsed.data,
  });

  if (error) return databaseError(error, DUPLICATE_LICENSE);

  revalidateDrivers();
  return formSuccess();
}

export async function updateDriverAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing drivers.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That driver could not be found.");

  const parsed = driverSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("drivers")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_LICENSE);

  revalidateDrivers();
  return formSuccess();
}

export async function deleteDriverAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete drivers.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That driver could not be found.");

  const { error } = await supabase.from("drivers").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidateDrivers();
  return formSuccess();
}

/** Bulk delete from the table's selection bar. */
export async function deleteDriversAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can delete drivers." };
  }

  const parsed = uuid.array().max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase.from("drivers").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateDrivers();
  return { ok: true, data: undefined };
}
