import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/session";
import { geoProvider } from "@/lib/services/geo";

export const dynamic = "force-dynamic";

const querySchema = z.string().trim().min(3).max(200);
/** Google session tokens are UUIDs; anything else is ignored rather than sent. */
const sessionSchema = z.uuid();

/**
 * Read-only address lookup endpoint.
 *
 * Next.js dispatches Server Actions sequentially in the browser, which makes
 * a typeahead queue stale requests. A GET handler lets the browser cancel the
 * previous lookup as soon as the operator types another character.
 */
export async function GET(request: NextRequest) {
  // Verified from the access token's signature, with no call to the Auth API —
  // this runs on every keystroke, so a round trip here would be felt directly.
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [], provider: null });
  }

  const provider = geoProvider();
  if (!provider.canSuggest) {
    return NextResponse.json({
      suggestions: [],
      provider: provider.name,
      available: false,
    });
  }

  const session = sessionSchema.safeParse(
    request.nextUrl.searchParams.get("session"),
  );

  const suggestions = await provider.suggest(
    parsed.data,
    6,
    request.signal,
    session.success ? session.data : undefined,
  );

  return NextResponse.json(
    {
      suggestions,
      provider: provider.name,
      available: true,
      /** The browser must call /api/geo/resolve before it has coordinates. */
      needsResolve: suggestions.some((hit) => hit.point === null),
    },
    {
      headers: {
        // Predictions are tied to a billing session and to a moment in time,
        // so no shared cache may keep them. The client holds its own short
        // in-memory cache for the backspacing an operator does while typing.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
