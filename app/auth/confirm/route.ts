import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { landingPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** An explicit, same-origin redirect target, or null. */
function explicitNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Handles Supabase email links that use `token_hash` (email confirmation,
 * password recovery, email change, and team invitations) rather than a PKCE
 * code.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = explicitNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link is invalid.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "That link has expired. Request a new one.",
      )}`,
    );
  }

  return NextResponse.redirect(`${origin}${next ?? (await landingPath())}`);
}
