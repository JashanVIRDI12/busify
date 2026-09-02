import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/refresh";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`.
 * Runs on every non-asset request to keep the Supabase session fresh.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never carry a
     * session that needs refreshing.
     *
     * `/assets/*` and `.html` are the VIABUS marketing site, served straight
     * out of `public/`. Those requests are anonymous by definition, and a home
     * page pulling 364 sequence frames would otherwise mean 364 pointless
     * session refreshes.
     */
    "/((?!_next/static|_next/image|assets/|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html|mp4)$).*)",
  ],
};
