import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACTION_NAMES, executeAction, isActionName } from "@/lib/ai/actions";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().refine(isActionName, {
    message: `Action must be one of: ${ACTION_NAMES.join(", ")}`,
  }),
  args: z.record(z.string(), z.unknown()),
});

/**
 * Apply an action the operator has confirmed.
 *
 * The payload arrives from the browser, so it is treated as untrusted: the
 * action name is checked against a fixed allowlist, the arguments go through
 * the action's own Zod schema, the role is checked, and the write runs on the
 * operator's RLS-scoped client.
 *
 * A tampered payload therefore cannot do anything the signed-in operator could
 * not already do by hand in the interface — which is the correct bar, because
 * the human clicking Confirm is the authority here.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid action." },
      { status: 400 },
    );
  }

  const { name, args } = parsed.data;
  if (!isActionName(name)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const result = await executeAction(name, args, session);

  if (result.ok) {
    // The operator is looking at a page that probably just went stale.
    for (const path of [
      "/dashboard",
      "/trip-requests",
      "/trips",
      "/customers",
      "/quotes",
      "/bookings",
    ]) {
      revalidatePath(path);
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
