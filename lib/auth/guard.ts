import "server-only";

import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";

import { getSession, type Session } from "@/lib/auth/session";
import { formError, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything a Server Action needs: an authenticated session, its active
 * organization, and a request-scoped Supabase client.
 *
 * Callers must still check the role before writing. RLS will reject an
 * unauthorised write regardless — this is so the user gets a sentence instead
 * of a database error.
 */
export async function actionContext(): Promise<{
  session: Session;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  // getSession already performs the trusted user check. The previous version
  // called auth.getUser() here and then again through getSession(), adding a
  // full Auth API round trip to every action.
  const [session, supabase] = await Promise.all([
    getSession(),
    createClient(),
  ]);
  if (!session) redirect("/onboarding");

  return { session, supabase };
}

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FK_VIOLATION = "23503";
const RLS_VIOLATION = "42501";

/**
 * Turn a Postgres error into something an operator can act on, without
 * leaking constraint names or SQL into the UI.
 */
export function databaseError(
  error: PostgrestError,
  overrides: Record<string, string> = {},
): FormState {
  for (const [needle, message] of Object.entries(overrides)) {
    if (error.message.includes(needle)) return formError(message);
  }

  switch (error.code) {
    case UNIQUE_VIOLATION:
      return formError("That value is already in use in this organization.");
    case CHECK_VIOLATION:
      return formError("Some of those values are outside the allowed range.");
    case FK_VIOLATION:
      return formError(
        "That record is still referenced elsewhere, so it cannot be changed.",
      );
    case RLS_VIOLATION:
      return formError("Your role does not allow this change.");
    default:
      console.error("Database error", error);
      return formError("Something went wrong. Please try again.");
  }
}
