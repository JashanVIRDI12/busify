"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  formDataToObject,
  formError,
  validationError,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/validations/organization";

export async function createOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = createOrganizationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;

  // Organizations are created only through this RPC: it inserts the row and
  // the caller's OWNER membership in one transaction, which is why the table
  // has no INSERT policy at all.
  const { error } = await supabase.rpc("create_organization", {
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_city: input.city,
    p_state: input.state,
    p_postal_code: input.postal_code,
    p_country: input.country,
    p_timezone: input.timezone,
    p_currency: input.currency,
  });

  if (error) {
    console.error("create_organization failed", error);
    return formError("We could not create your organization. Please try again.");
  }

  revalidatePath("/", "layout");
  // Not /quotes. A brand-new organization has no rate card, so the builder
  // would price every quote at zero — and an empty list is a poor first screen
  // besides. /setup is the short list of things that have to be true first.
  redirect("/setup");
}
