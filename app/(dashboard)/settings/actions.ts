"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { serverEnv, siteUrl } from "@/lib/env";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, ASSIGNABLE_ROLES } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteSchema, NEW_DRIVER } from "@/lib/validations/invitation";
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

/** Supabase reports an existing account with a handful of phrasings. */
function isAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("email_exists") ||
    m.includes("user already exists")
  );
}

export async function inviteMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can invite people.");
  }

  const parsed = inviteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { email, role, driver_id, driver_first_name, driver_last_name } =
    parsed.data;
  const orgId = session.organization.id;

  // Resolve the driver record a DRIVER invitation attaches to.
  let resolvedDriverId: string | null = null;
  if (role === "DRIVER") {
    if (driver_id === NEW_DRIVER) {
      const { data: created, error: createError } = await supabase
        .from("drivers")
        .insert({
          organization_id: orgId,
          first_name: driver_first_name ?? "",
          last_name: driver_last_name,
        })
        .select("id")
        .single();

      if (createError) return databaseError(createError);
      if (!created) return formError("Could not create the driver record.");
      resolvedDriverId = created.id;
    } else {
      const { data: existing } = await supabase
        .from("drivers")
        .select("id, user_id")
        .eq("id", driver_id as string)
        .maybeSingle();

      if (!existing) return formError("That driver record could not be found.");
      if (existing.user_id) {
        return formError("That driver already has a login.");
      }
      resolvedDriverId = existing.id;
    }
  }

  const { error: inviteRowError } = await supabase.from("invitations").insert({
    organization_id: orgId,
    email,
    role,
    driver_id: resolvedDriverId,
    invited_by: session.user.id,
  });

  if (inviteRowError) {
    return databaseError(inviteRowError, {
      invitations_pending_key:
        "There is already a pending invitation for that address.",
    });
  }

  const redirectTo = `${siteUrl()}/auth/callback?next=/invite/accept`;
  const admin = createAdminClient();
  const { error: sendError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (sendError && isAlreadyRegistered(sendError.message)) {
    // They already have an account — send a magic link instead. The invitation
    // row is already in place for accept_invitation() to pick up.
    const env = serverEnv();
    const anon = createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: otpError } = await anon.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    if (otpError) {
      return formError(
        `Invitation saved, but the email could not be sent: ${otpError.message}`,
      );
    }
  } else if (sendError) {
    return formError(`Could not send the invitation: ${sendError.message}`);
  }

  revalidatePath("/settings/organization");
  revalidatePath("/drivers");
  return formSuccess(`Invitation sent to ${email}.`);
}

export async function revokeInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can revoke invitations.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That invitation could not be found.");

  const { error } = await supabase
    .from("invitations")
    .update({ status: "REVOKED" })
    .eq("id", id.data)
    .eq("status", "PENDING");

  if (error) return databaseError(error);

  revalidatePath("/settings/organization");
  return formSuccess("Invitation revoked.");
}
