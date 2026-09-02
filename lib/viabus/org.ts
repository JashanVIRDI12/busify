import "server-only";

import { cache } from "react";

import { serverEnv } from "@/lib/env";
import {
  getPublicOrganization,
  type PublicOrganization,
} from "@/lib/queries/public-org";

/**
 * Single-tenant resolution.
 *
 * Busify is multi-tenant and resolves the operator from a URL slug. This
 * deployment serves exactly one operator, so there is no slug to read: the
 * organization is pinned by environment and the public routes never accept a
 * tenant identifier from the browser at all.
 *
 * The multi-tenant schema is deliberately left intact underneath — every table
 * still carries `organization_id` and every RLS policy still enforces it. That
 * costs nothing with one tenant, and it means this stays a configuration
 * difference rather than a fork of the data model.
 */
const DEFAULT_SLUG = "viabus";

export function viabusSlug(): string {
  return serverEnv().VIABUS_ORG_SLUG ?? DEFAULT_SLUG;
}

/** Deduplicated per request — several callers on one page share the lookup. */
export const getViabusOrganization = cache(
  async (): Promise<PublicOrganization | null> => {
    return getPublicOrganization(viabusSlug());
  },
);

/**
 * For write paths that cannot proceed without the tenant. Throws rather than
 * returning null: a missing organization row is a deployment fault, not a
 * user-facing condition, and silently writing nowhere would be worse.
 */
export async function requireViabusOrganization(): Promise<PublicOrganization> {
  const organization = await getViabusOrganization();

  if (!organization) {
    throw new Error(
      `No organization found with slug "${viabusSlug()}". ` +
        `Seed one, or set VIABUS_ORG_SLUG to match the row that exists.`,
    );
  }

  return organization;
}
