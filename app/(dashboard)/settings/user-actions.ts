"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { siteUrl } from "@/lib/env";
import { sendMail } from "@/lib/mail/send";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, ROLE_LABELS } from "@/lib/permissions";
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

  // Not /auth/callback. That route exchanges a PKCE code, which needs the
  // `code_verifier` cookie set in the browser that *started* the flow — and an
  // invite is generated here, server-side, for a browser that has never seen
  // this app. The exchange could never succeed, so every invitee was told the
  // link had expired. Invites are token_hash links, same as recovery.
  //
  // They land on /reset-password rather than /quotes because an invited account
  // has no password yet: dropping them straight into the console would leave
  // them unable to ever sign in again.
  //
  // generateLink rather than inviteUserByEmail so the token hash comes back to
  // us instead of going straight into Supabase's own email. That removes the
  // last thing standing between an operator and a working invitation: whether
  // the project's email template happens to be configured to emit a token_hash
  // at all. We build the URL, and we decide how it travels.
  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: full_name ? { full_name } : undefined,
      redirectTo: `${siteUrl()}/reset-password`,
    },
  });

  let userId = invite.data.user?.id ?? null;
  const tokenHash = invite.data.properties?.hashed_token ?? null;

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

  // Already had an account: they keep their existing password, so there is no
  // link to hand over and nothing to send.
  if (!tokenHash) {
    return formSuccess(`${email} already had an account and has been added`);
  }

  const inviteUrl =
    `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=invite&next=${encodeURIComponent("/reset-password")}`;

  const invitedBy = session.user.email ?? "a colleague";
  const sent = await sendMail({
    to: email,
    subject: `${invitedBy} invited you to ${session.organization.name} on Busify`,
    text: [
      full_name ? `Hi ${full_name.split(" ")[0]},` : "Hi,",
      "",
      `${invitedBy} has invited you to join ${session.organization.name} on Busify as ${ROLE_LABELS[role]}.`,
      "",
      "Open this link to choose your password and sign in:",
      inviteUrl,
      "",
      "If you weren't expecting this, you can ignore it.",
    ].join("\n"),
  });

  // Never claim an email went out when it did not. With no provider configured
  // the link comes back to the operator instead, so an invitation is still a
  // thing they can actually complete — by pasting it into their own email.
  if (!sent.ok || !sent.delivered) {
    return formSuccess(
      `${email} has been added. No mail provider is configured, so send them this link yourself.`,
      { inviteUrl },
    );
  }

  return formSuccess(`Invitation sent to ${email}`, { inviteUrl });
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
