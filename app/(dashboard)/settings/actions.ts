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
import { canManage, ASSIGNABLE_ROLES } from "@/lib/permissions";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { uuid } from "@/lib/validations/shared";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name").max(120),
});

const roleSchema = z.object({
  memberId: uuid,
  role: z.enum(["OWNER", ...ASSIGNABLE_ROLES] as [string, ...string[]]),
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

export async function updateOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can change organization settings.");
  }

  const parsed = updateOrganizationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.organization.id);

  if (error) return databaseError(error);

  revalidatePath("/", "layout");
  return formSuccess("Organization updated.");
}

export async function updateMemberRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can change roles.");
  }

  const parsed = roleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.role === "OWNER" && session.role !== "OWNER") {
    return formError("Only an owner can promote someone to owner.");
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data.role as never })
    .eq("id", parsed.data.memberId);

  if (error) {
    return databaseError(error, {
      "at least one OWNER":
        "This is the only owner. Promote someone else to owner first.",
    });
  }

  revalidatePath("/settings/organization");
  return formSuccess("Role updated.");
}

export async function removeMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can remove people.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That member could not be found.");

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", id.data);

  if (error) {
    return databaseError(error, {
      "at least one OWNER":
        "This is the only owner. Promote someone else to owner first.",
    });
  }

  revalidatePath("/settings/organization");
  return formSuccess();
}
