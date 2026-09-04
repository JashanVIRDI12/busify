"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getMemberships, landingPath } from "@/lib/auth/session";
import {
  formDataToObject,
  formError,
  validationError,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";

/**
 * Consume the invitation that the sign-in link carried: set the password the
 * invitee will use from now on, then run accept_invitation(), which creates the
 * membership row (and links the driver record) in one transaction.
 */
export async function acceptInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return formError(
      "This invitation link has expired. Ask for a new one and try again.",
    );
  }

  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError) return formError(passwordError.message);

  const { error: acceptError } = await supabase.rpc("accept_invitation");
  if (acceptError) {
    return formError(
      "We could not add you to the organization. The invitation may have been revoked.",
    );
  }

  const memberships = await getMemberships();
  if (memberships.length === 0) {
    return formError(
      "This invitation is no longer valid. Ask an admin to invite you again.",
    );
  }

  revalidatePath("/", "layout");
  redirect(await landingPath());
}
