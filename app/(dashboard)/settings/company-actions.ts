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
import { canManage } from "@/lib/permissions";
import {
  brandingSchema,
  companyProfileSchema,
  defaultsSchema,
  driverPaySettingsSchema,
  emailTemplateSchema,
  termsSchema,
} from "@/lib/validations/settings";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/**
 * Settings are configuration, not day-to-day work, so every write here is
 * manager-only. RLS enforces the same rule; this exists so the operator gets a
 * sentence rather than a database error.
 */
const DENIED = "Only owners and admins can change settings.";

function revalidateSettings() {
  revalidatePath("/settings", "layout");
}

/** Repeated form fields, deduplicated and trimmed. */
function readList(formData: FormData, name: string, max = 40): string[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, max);
}

/* -------------------------------------------------------------------------- */
/* Company profile and branding                                               */
/* -------------------------------------------------------------------------- */

export async function updateCompanyProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = companyProfileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.organization.id);

  if (error) return databaseError(error);

  revalidateSettings();
  return formSuccess("Company profile saved");
}

export async function updateBrandingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = brandingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.organization.id);

  if (error) return databaseError(error);

  revalidateSettings();
  return formSuccess("Branding saved");
}

/* -------------------------------------------------------------------------- */
/* Quote defaults                                                             */
/* -------------------------------------------------------------------------- */

export async function updateDefaultsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = defaultsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const bases = readList(formData, "pricing_bases", 4);

  const { error } = await supabase.from("organization_settings").upsert(
    {
      organization_id: session.organization.id,
      ...parsed.data,
      // CHOOSE with nothing selected would price every quote at zero, so it
      // falls back to the daily rate rather than being stored empty.
      pricing_bases:
        parsed.data.pricing_mode === "CHOOSE" && bases.length > 0
          ? bases
          : ["DAILY"],
      event_types: readList(formData, "event_types"),
      widget_vehicle_types: readList(formData, "widget_vehicle_types", 20),
    },
    { onConflict: "organization_id" },
  );

  if (error) return databaseError(error);

  revalidateSettings();
  revalidatePath("/quotes");
  return formSuccess("Defaults saved");
}

/* -------------------------------------------------------------------------- */
/* Driver pay settings                                                        */
/* -------------------------------------------------------------------------- */

export async function updateDriverPaySettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = driverPaySettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rateTypes = readList(formData, "pay_rate_types", 12);

  const { error } = await supabase.from("organization_settings").upsert(
    {
      organization_id: session.organization.id,
      ...parsed.data,
      // With no rate types there is nothing to pick on a reservation, so an
      // empty list falls back to the hourly default rather than locking payroll.
      pay_rate_types: rateTypes.length > 0 ? rateTypes : ["Hourly"],
    },
    { onConflict: "organization_id" },
  );

  if (error) return databaseError(error);

  revalidateSettings();
  revalidatePath("/driver-pay");
  return formSuccess("Driver pay settings saved");
}

/* -------------------------------------------------------------------------- */
/* Email templates                                                            */
/* -------------------------------------------------------------------------- */

export async function updateEmailTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = emailTemplateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("email_templates")
    .upsert(
      { organization_id: session.organization.id, ...parsed.data },
      { onConflict: "organization_id,kind" },
    );

  if (error) return databaseError(error);

  revalidateSettings();
  return formSuccess("Template saved");
}

/* -------------------------------------------------------------------------- */
/* Terms                                                                      */
/* -------------------------------------------------------------------------- */

const DUPLICATE_TERMS = {
  contract_terms_org_kind_name_unique:
    "You already have terms with that name.",
};

/**
 * Only one set of terms per kind can be the default, so setting one clears the
 * others. Two statements rather than a partial unique index, because the
 * operator's intent is "make this the default", not "fail because another is".
 */
async function clearOtherDefaults(
  supabase: Awaited<ReturnType<typeof actionContext>>["supabase"],
  kind: "CONTRACT" | "QUOTE",
  keepId: string | null,
) {
  let query = supabase
    .from("contract_terms")
    .update({ is_default: false })
    .eq("kind", kind)
    .eq("is_default", true);

  if (keepId) query = query.neq("id", keepId);
  await query;
}

export async function saveTermsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return formError(DENIED);

  const parsed = termsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuid.safeParse(rawId) : null;

  if (parsed.data.is_default) {
    await clearOtherDefaults(supabase, parsed.data.kind, id?.success ? id.data : null);
  }

  if (id?.success) {
    const { error } = await supabase
      .from("contract_terms")
      .update(parsed.data)
      .eq("id", id.data);

    if (error) return databaseError(error, DUPLICATE_TERMS);
  } else {
    const { error } = await supabase
      .from("contract_terms")
      .insert({ organization_id: session.organization.id, ...parsed.data });

    if (error) return databaseError(error, DUPLICATE_TERMS);
  }

  revalidateSettings();
  return formSuccess("Terms saved");
}

export async function deleteTermsAction(id: string): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();
  if (!canManage(session.role)) return { ok: false, message: DENIED };

  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Those terms were not found." };

  // Quotes referencing these terms keep their row; the foreign key is
  // ON DELETE SET NULL, so a sent quote does not lose its own copy.
  const { error } = await supabase
    .from("contract_terms")
    .delete()
    .eq("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidateSettings();
  return { ok: true, data: undefined };
}
