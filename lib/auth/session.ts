import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Tables } from "@/types/database";

export type Organization = Tables<"organizations">;

/**
 * The fields of the signed-in user that this application actually reads.
 *
 * Deliberately narrower than Supabase's `User`: everything here comes out of
 * the access token's verified claims, so the type cannot promise a column that
 * only the Auth API can answer for.
 */
export type SessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

export type Session = {
  user: SessionUser;
  organization: Organization;
  role: OrgRole;
};

/**
 * The signed-in user, taken from the access token's verified claims.
 *
 * This used to call `auth.getUser()`, which asks the Auth API to re-validate
 * the token on every invocation. That put a round trip to the project's region
 * in front of every page, server action and route handler — the largest fixed
 * cost in a request here, because the project is not co-located with the people
 * using it.
 *
 * `getClaims()` verifies the same token locally against the project's
 * asymmetric signing keys, fetching the JWKS once and caching it for the life
 * of the server process. The identity is still cryptographically proven; what
 * is traded away is immediacy, because a session revoked elsewhere stays usable
 * here until its access token expires. RLS, not this function, remains the
 * authority on what that identity may read or write.
 *
 * Deduplicated per request, so several Server Components on one page share it.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: claims.email ?? null,
    user_metadata: claims.user_metadata ?? {},
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

type MembershipRow = {
  role: OrgRole;
  organizations: Organization | null;
};

/**
 * The caller's memberships, newest organization first.
 *
 * RLS already restricts this to the current user, so there is no user_id
 * filter here — adding one would imply the filter is what makes it safe.
 */
export const getMemberships = cache(
  async (): Promise<{ role: OrgRole; organization: Organization }[]> => {
    const user = await getUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, organizations(*)")
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

  return session;
}
