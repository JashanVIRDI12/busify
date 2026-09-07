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
  customChargeSchema,
  industrySchema,
  savedStopSchema,
  vehicleRateSchema,
} from "@/lib/validations/settings";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/**
 * The reference data a quote is built from: the rate card, the reusable
 * charges, the addresses and the industries.
 *
 * All manager-only except saved stops — a dispatcher mid-itinerary should be
 * able to keep the address they just typed, or they will retype it forever.
 */
const DENIED = "Only owners and admins can change settings.";

function revalidateSettings(...extra: string[]) {
  revalidatePath("/settings", "layout");
  for (const path of extra) revalidatePath(path);
}

/* -------------------------------------------------------------------------- */
/* Vehicle rates                                                              */
/* -------------------------------------------------------------------------- */

const DUPLICATE_RATE = {
  vehicle_rates_organization_id_vehicle_type_id_vehicle_id_key:
    "There is already a rate for that vehicle type and vehicle.",
};

export async function saveVehicleRateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = vehicleRateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuid.safeParse(rawId) : null;

  if (id?.success) {
    const { error } = await supabase
      .from("vehicle_rates")
      .update(parsed.data)
      .eq("id", id.data);
    if (error) return databaseError(error, DUPLICATE_RATE);
  } else {
    const { error } = await supabase
      .from("vehicle_rates")
      .insert({ organization_id: session.organization.id, ...parsed.data });
    if (error) return databaseError(error, DUPLICATE_RATE);
  }

  revalidateSettings("/quotes");
  return formSuccess("Rate saved");
}

export async function deleteVehicleRatesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return { ok: false, message: DENIED };

  const parsed = uuid.array().max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "That selection could not be read." };

  const { error } = await supabase
    .from("vehicle_rates")
    .delete()
    .in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateSettings();
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Custom charges, markups and taxes                                          */
/* -------------------------------------------------------------------------- */

const DUPLICATE_CHARGE = {
  custom_charges_organization_id_category_name_key:
    "You already have one with that name.",
};

export async function saveCustomChargeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = customChargeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuid.safeParse(rawId) : null;

  if (id?.success) {
    const { error } = await supabase
      .from("custom_charges")
      .update(parsed.data)
      .eq("id", id.data);
    if (error) return databaseError(error, DUPLICATE_CHARGE);
  } else {
    const { error } = await supabase
      .from("custom_charges")
      .insert({ organization_id: session.organization.id, ...parsed.data });
    if (error) return databaseError(error, DUPLICATE_CHARGE);
  }

  revalidateSettings("/quotes");
  return formSuccess("Saved");
}

export async function deleteCustomChargesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return { ok: false, message: DENIED };

  const parsed = uuid.array().max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "That selection could not be read." };

  // Charges already copied onto a quote are unaffected: `quote_trip_charges`
  // holds its own copy, so deleting the template never re-prices a sent quote.
  const { error } = await supabase
    .from("custom_charges")
    .delete()
    .in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateSettings();
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Saved stops                                                                */
/* -------------------------------------------------------------------------- */

const DUPLICATE_STOP = {
  saved_stops_organization_id_name_key: "You already have a stop with that name.",
};

export async function saveSavedStopAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canWrite(session.role)) {
    return formError("Your role does not allow saving stops.");
  }

  const parsed = savedStopSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuid.safeParse(rawId) : null;

  if (id?.success) {
    const { error } = await supabase
      .from("saved_stops")
      .update(parsed.data)
      .eq("id", id.data);
    if (error) return databaseError(error, DUPLICATE_STOP);
  } else {
    const { error } = await supabase
      .from("saved_stops")
      .insert({ organization_id: session.organization.id, ...parsed.data });
    if (error) return databaseError(error, DUPLICATE_STOP);
  }

  revalidateSettings();
  return formSuccess("Stop saved");
}

export async function deleteSavedStopsAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return { ok: false, message: DENIED };

  const parsed = uuid.array().max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "That selection could not be read." };

  const { error } = await supabase.from("saved_stops").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateSettings();
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Industries                                                                 */
/* -------------------------------------------------------------------------- */

const DUPLICATE_INDUSTRY = {
  industries_organization_id_name_key: "That industry already exists.",
};

export async function saveIndustryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = industrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuid.safeParse(rawId) : null;

  if (id?.success) {
    const { error } = await supabase
      .from("industries")
      .update(parsed.data)
      .eq("id", id.data);
    if (error) return databaseError(error, DUPLICATE_INDUSTRY);
  } else {
    const { error } = await supabase
      .from("industries")
      .insert({ organization_id: session.organization.id, ...parsed.data });
    if (error) return databaseError(error, DUPLICATE_INDUSTRY);
  }

  revalidateSettings("/contacts", "/companies");
  return formSuccess("Industry saved");
}

export async function deleteIndustriesAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return { ok: false, message: DENIED };

  const parsed = uuid.array().max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "That selection could not be read." };

  // Contacts and companies store the industry as text, so removing it here
  // leaves their existing value alone rather than blanking historical records.
  const { error } = await supabase.from("industries").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateSettings("/contacts", "/companies");
  return { ok: true, data: undefined };
}
