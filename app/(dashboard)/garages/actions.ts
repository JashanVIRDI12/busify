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
import { garageAddressLine, locateGarage, setDefaultGarage } from "@/lib/garages";
import { canManage, canWrite } from "@/lib/permissions";
import { garageSchema, type GarageInput } from "@/lib/validations/garage";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const DUPLICATE_NAME = {
  garages_organization_id_name_key: "You already have a garage with that name.",
};

function revalidateGarages() {
  revalidatePath("/settings/garages");
  revalidatePath("/settings");
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
}

/**
 * Saved either way — a garage without a location is still a garage — but the
 * operator is told, because every quote from it will show zero dead miles.
 */
function savedMessage(garage: GarageInput, latitude: number | null) {
  if (latitude !== null) return undefined;
  return garageAddressLine(garage)
    ? "Saved, but that address could not be found on the map, so dead kilometres cannot be measured from it. Check the street, city and postal code."
    : "Saved. Add an address so dead kilometres can be measured from this garage.";
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

  const location = await locateGarage(parsed.data);

  const { data: created, error } = await supabase
    .from("garages")
    .insert({
      organization_id: session.organization.id,
      ...parsed.data,
      ...location,
    })
    .select("id")
    .single();

  if (error) return databaseError(error, DUPLICATE_NAME);
  if (!created) return formError("The garage could not be saved.");

  if (parsed.data.is_default) {
    await setDefaultGarage(supabase, session.organization.id, created.id, {
      syncSetting: canManage(session.role),
    });
  }

  revalidateGarages();
  return formSuccess(savedMessage(parsed.data, location.latitude));
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

  // Re-located on every save: the address may be what just changed, and a
  // stale point would keep measuring from the old yard.
  const location = await locateGarage(parsed.data);

  const { error } = await supabase
    .from("garages")
    .update({ ...parsed.data, ...location })
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_NAME);

  const syncSetting = canManage(session.role);
  if (parsed.data.is_default) {
    await setDefaultGarage(supabase, session.organization.id, id.data, {
      syncSetting,
    });
  } else if (syncSetting) {
    // Unticking the default garage means new quotes start without one.
    await supabase
      .from("organization_settings")
      .update({ default_garage_id: null })
      .eq("organization_id", session.organization.id)
      .eq("default_garage_id", id.data);
  }

  revalidateGarages();
  return formSuccess(savedMessage(parsed.data, location.latitude));
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
