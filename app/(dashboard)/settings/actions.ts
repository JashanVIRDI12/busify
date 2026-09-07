"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name").max(120),
});

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  const parsed = profileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", session.user.id);

  if (profileError) return databaseError(profileError);

  // Keep the auth metadata in step so the topbar and future emails agree.
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.full_name },
  });

  if (authError) return formError(authError.message);

  revalidatePath("/", "layout");
  return formSuccess("Profile updated.");
}



