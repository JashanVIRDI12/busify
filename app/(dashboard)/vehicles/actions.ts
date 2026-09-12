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
import {
  readAmenities,
  vehicleSchema,
  vehicleTypeSchema,
} from "@/lib/validations/vehicle";
import { uuid, type ActionResult } from "@/lib/validations/shared";

const DUPLICATE_REGISTRATION = {
  vehicles_organization_id_registration_number_key:
    "A vehicle with that registration number already exists.",
};

const DUPLICATE_TYPE_NAME = {
  vehicle_types_organization_id_name_key:
    "You already have a vehicle type with that name.",
};

function revalidateFleet() {
  revalidatePath("/vehicles");
  revalidatePath("/vehicles/types");
  revalidatePath("/reports");
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function createVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding vehicles.");
  }

  const parsed = vehicleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("vehicles").insert({
    organization_id: session.organization.id,
    ...parsed.data,
    amenities: readAmenities(formData.getAll("amenities")),
  });

  if (error) return databaseError(error, DUPLICATE_REGISTRATION);

  revalidateFleet();
  return formSuccess();
}

export async function updateVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing vehicles.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That vehicle could not be found.");

  const parsed = vehicleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("vehicles")
    .update({
      ...parsed.data,
      amenities: readAmenities(formData.getAll("amenities")),
    })
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_REGISTRATION);

  revalidateFleet();
  return formSuccess();
}

/** Bulk delete from the table's selection bar. */
export async function deleteVehiclesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can delete vehicles." };
  }

  const parsed = uuid.array().max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase.from("vehicles").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateFleet();
  return { ok: true, data: undefined };
}

export async function deleteVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete vehicles.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That vehicle could not be found.");

  const { error } = await supabase.from("vehicles").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidateFleet();
  return formSuccess();
}

// ---------------------------------------------------------------------------
// Vehicle types
// ---------------------------------------------------------------------------

export async function createVehicleTypeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow adding vehicle types.");
  }

  const parsed = vehicleTypeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase.from("vehicle_types").insert({
    organization_id: session.organization.id,
    ...parsed.data,
  });

  if (error) return databaseError(error, DUPLICATE_TYPE_NAME);

  revalidateFleet();
  return formSuccess();
}

export async function updateVehicleTypeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing vehicle types.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That vehicle type could not be found.");

  const parsed = vehicleTypeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("vehicle_types")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) return databaseError(error, DUPLICATE_TYPE_NAME);

  revalidateFleet();
  return formSuccess();
}

export async function deleteVehicleTypeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can delete vehicle types.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That vehicle type could not be found.");

  // Vehicles referencing this type keep their row; the composite FK is
  // ON DELETE SET NULL, so they simply become untyped.
  const { error } = await supabase.from("vehicle_types").delete().eq("id", id.data);

  if (error) return databaseError(error);

  revalidateFleet();
  return formSuccess();
}
