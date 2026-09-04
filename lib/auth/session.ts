import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Tables } from "@/types/database";

export type Organization = Tables<"organizations">;

export type Session = {
  user: User;
  organization: Organization;
  role: OrgRole;
};

/**
 * Deduplicated per request — several Server Components on the same page can
 * call this without producing several round trips.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

type MembershipRow = {
  role: OrgRole;
  organizations: Organization | null;
};

/**
 * The caller's own memberships, oldest organization first.
 *
 * The `organization_members` SELECT policy lets a member read *every* member
 * row of an organization they belong to, not just their own — so the
 * `user_id` filter here is a correctness requirement, not a security one.
 * Without it a member of a multi-person org could resolve a teammate's role
 * as their own.
 */
export const getMemberships = cache(
  async (): Promise<{ role: OrgRole; organization: Organization }[]> => {
    const user = await getUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, organizations(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load memberships", error);
      return [];
    }

    const rows = (data ?? []) as unknown as MembershipRow[];

    return rows
      .filter(
        (row): row is MembershipRow & { organizations: Organization } =>
          row.organizations !== null,
      )
      .map((row) => ({ role: row.role, organization: row.organizations }));
  },
);

/**
 * Resolves the active organization for a dashboard request.
 *
 * Phase 1 keeps one organization per operator, so the first membership wins.
 * When multi-org switching lands, this is the single place that changes.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getUser();
  if (!user) return null;

  const memberships = await getMemberships();
  const active = memberships[0];
  if (!active) return null;

  return { user, organization: active.organization, role: active.role };
});

export async function requireSession(): Promise<Session> {
  const user = await getUser();
  if (!user) redirect("/login");

  const session = await getSession();
  if (!session) redirect("/onboarding");

  // Drivers do not use the operations console — they get the portal.
  if (session.role === "DRIVER") redirect("/driver");

  return session;
}

export type DriverContext = {
  user: User;
  organization: Organization;
  driver: Tables<"drivers">;
};

type DriverContextRow = Tables<"drivers"> & {
  organizations: Organization | null;
};

/**
 * The signed-in user's driver record and its organization, or null if this
 * account is not a linked driver. Deduplicated per request like getSession().
 */
export const getDriverContext = cache(async (): Promise<DriverContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drivers")
    .select("*, organizations(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const { organizations, ...driver } = data as unknown as DriverContextRow;
  if (!organizations) return null;

  return { user, organization: organizations, driver };
});

export async function requireDriver(): Promise<DriverContext> {
  const user = await getUser();
  if (!user) redirect("/driver/login");

  const context = await getDriverContext();
  // Signed in but not a driver — send them to the operations dashboard.
  if (!context) redirect("/dashboard");

  return context;
}

/**
 * Where a signed-in user belongs. A DRIVER lands in the driver portal;
 * everyone else in the operations dashboard. This is the single source of
 * truth so the login form, the PKCE callback and the email-confirm handler all
 * agree — a driver never briefly sees the dashboard shell.
 */
export async function landingPath(): Promise<string> {
  const memberships = await getMemberships();
  const active = memberships[0];
  if (!active) return "/onboarding";
  return active.role === "DRIVER" ? "/driver" : "/dashboard";
}
