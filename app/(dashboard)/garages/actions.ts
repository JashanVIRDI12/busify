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
import { garageSchema } from "@/lib/validations/garage";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const DUPLICATE_NAME = {
  garages_organization_id_name_key: "You already have a garage with that name.",
};

function revalidateGarages() {
  revalidatePath("/settings/garages");
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
}

/**
 * Only one garage can be the default, so setting one clears the rest. Done in
 * two statements rather than a partial unique index because the operator's
 * intent is "make this the default", not "fail because another one already is".
 */
async function clearOtherDefaults(
  supabase: Awaited<ReturnType<typeof actionContext>>["supabase"],
  keepId: string | null,
) {
  let query = supabase.from("garages").update({ is_default: false }).eq("is_default", true);
  if (keepId) query = query.neq("id", keepId);
  await query;
}

export async function createGarageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding garages.");
  }

  const parsed = garageSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.is_default) await clearOtherDefaults(supabase, null);

  const { error } = await supabase.from("garages").insert({
    organization_id: session.organization.id,
    ...parsed.data,
  });

  if (error) return databaseError(error, DUPLICATE_NAME);

  revalidateGarages();
  return formSuccess();
}

export async function updateGarageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing garages.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That garage could not be found.");

  const parsed = garageSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.is_default) await clearOtherDefaults(supabase, id.data);

  const { error } = await supabase
    .from("garages")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_NAME);

  revalidateGarages();
  return formSuccess();
}

export async function deleteGaragesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can delete garages." };
  }

  const parsed = uuid.array().max(100).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  // Vehicles, drivers and reservations pointing here are nulled out by the
  // foreign keys; the depot closing does not delete the work done from it.
  const { error } = await supabase.from("garages").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateGarages();
  return { ok: true, data: undefined };
}
