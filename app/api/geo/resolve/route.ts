import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/session";
import { geoProvider } from "@/lib/services/geo";

export const dynamic = "force-dynamic";

const placeSchema = z.string().trim().min(1).max(500);
const sessionSchema = z.uuid();

/**
 * Coordinates for a suggestion the operator picked.
 *
 * Google's autocomplete answers with place ids rather than locations, and bills
 * the lookup that turns one into coordinates. Doing that for every row of every
 * keystroke would be both slow and expensive, so it happens exactly once — here,
 * for the row that was actually chosen.
 *
 * Passing the same session token that the typeahead used closes the billing
 * session, which is what makes the whole interaction count as one lookup rather
 * than one per keystroke.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = placeSchema.safeParse(
    request.nextUrl.searchParams.get("placeId"),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing place id." }, { status: 400 });
  }

  const provider = geoProvider();
  if (!provider.resolve) {
    // The active provider hands back coordinates with its suggestions, so the
    // browser should never have needed to ask.
    return NextResponse.json({ result: null, provider: provider.name });
  }

  const session = sessionSchema.safeParse(
    request.nextUrl.searchParams.get("session"),
  );

  const result = await provider.resolve(
    parsed.data,
    session.success ? session.data : undefined,
  );

  return NextResponse.json(
    { result, provider: provider.name },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
