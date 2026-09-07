"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { siteUrl } from "@/lib/env";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserSchema } from "@/lib/validations/settings";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/**
 * Adding someone to the organization.
 *
 * Two things have to happen and they live in different places: the person needs
 * an auth account, and they need a membership row. The membership is what this
 * product cares about; the account is Supabase's. So the flow is
 *
 *   1. invite (or find) the auth user, via the service-role admin client
 *   2. insert the membership through the *caller's* client, so RLS still
 *      decides whether they were allowed to
 *
 * Step 2 deliberately does not use the admin client. Doing the whole thing with
 * service role would mean the "only managers can invite" rule existed only in
 * the `canManage` check above — one edit away from being an authorization hole.
 */
export async function inviteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return formError("Only owners and admins can add people.");
  }

  const parsed = inviteUserSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { email, full_name, role } = parsed.data;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return formError(
      "Inviting people needs SUPABASE_SERVICE_ROLE_KEY to be set on the server.",
    );
  }

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: full_name ? { full_name } : undefined,
    redirectTo: `${siteUrl()}/auth/callback?next=/quotes`,
  });

  let userId = invite.data.user?.id ?? null;

  // Already has an account — with this operator or another. That is not an
  // error: they still need a membership here, so find them and carry on.
  if (!userId) {
    const existing = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    userId = existing.data?.id ?? null;
  }

  if (!userId) {
    console.error("Invite failed", invite.error);
    return formError(
      invite.error?.message ??
        "That invitation could not be sent. Check the address and try again.",
    );
  }

  const { error } = await supabase.from("organization_members").insert({
    organization_id: session.organization.id,
    user_id: userId,
    role,
  });

  if (error) {
    if (error.code === "23505") {
      return formError("That person is already in this organization.");
    }
    return databaseError(error);
  }

  revalidatePath("/settings/users");
  return formSuccess(
    invite.data.user
      ? `Invitation sent to ${email}`
      : `${email} already had an account and has been added`,
  );
}

const MEMBER_ROLES = [
  "ADMIN",
  "DISPATCHER",
  "STAFF",
  "ACCOUNTANT",
  "DRIVER",
] as const;

const ASSIGNABLE_BY_ROLE = {
  MANAGER: z.enum(MEMBER_ROLES),
  OWNER: z.enum([...MEMBER_ROLES, "OWNER"]),
};

export async function setMemberRoleAction(
  memberId: string,
  role: string,
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can change roles." };
  }

  const id = uuid.safeParse(memberId);
  if (!id.success) return { ok: false, message: "That member was not found." };

  // Only an owner can hand out ownership, so the set of assignable roles
  // depends on who is asking.
  const assignable = ASSIGNABLE_BY_ROLE[session.role === "OWNER" ? "OWNER" : "MANAGER"];
  const parsed = assignable.safeParse(role);

  if (!parsed.success) {
    return { ok: false, message: "That is not a role you can assign." };
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data })
    .eq("id", id.data);

  if (error) {
    return {
      ok: false,
      message:
        databaseError(error, {
          "at least one OWNER":
            "This is the only owner. Promote someone else first.",
        }).message ?? "That role could not be changed.",
    };
  }

  revalidatePath("/settings/users");
  return { ok: true, data: undefined };
}

export async function removeUsersAction(
  memberIds: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can remove people." };
  }

  const parsed = uuid.array().max(100).safeParse(memberIds);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  // Removes the membership, not the account. Their name stays on the quotes
  // and reservations they created, which is what an audit trail is for.
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .in("id", parsed.data);

  if (error) {
    return {
      ok: false,
      message:
        databaseError(error, {
          "at least one OWNER":
            "That would leave the organization without an owner.",
        }).message ?? "Those people could not be removed.",
    };
  }

  revalidatePath("/settings/users");
  return { ok: true, data: undefined };
}
