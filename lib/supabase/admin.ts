import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Reach for this only where a request has no user session and the operation is
 * genuinely system-level — the public booking widget in a later phase, or
 * background jobs. Every call site must scope by organization_id itself,
 * because the database will not do it for you here.
 */
export function createAdminClient() {
  const env = serverEnv();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the admin client is unavailable.",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
