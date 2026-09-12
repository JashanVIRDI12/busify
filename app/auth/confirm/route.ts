import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email links that use `token_hash` (email confirmation,
 * password recovery, email change) rather than a PKCE code.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/quotes";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/quotes";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link is invalid.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // "Expired" is what the operator should read, but it is only ever a guess:
    // a consumed, malformed or wrong-type token fails identically. Log what the
    // provider actually said so the next report is diagnosable.
    console.error(`Email link failed (type=${type})`, error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "That link has expired. Request a new one.",
      )}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
