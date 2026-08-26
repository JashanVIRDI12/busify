import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  phone: string | null;
  email: string | null;
  city: string | null;
};

/**
 * Look up an organization by its public slug for the booking page.
 *
 * Uses the service-role client because the caller is anonymous and `organizations`
 * has no anon SELECT policy — deliberately. Rather than opening the table to
 * `anon` and relying on column privileges to hide the rest, the whole lookup
 * stays server-side and returns only this hand-picked, customer-facing subset.
 * Address and internal fields never leave the server.
 */
export async function getPublicOrganization(
  slug: string,
): Promise<PublicOrganization | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, timezone, phone, email, city")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
