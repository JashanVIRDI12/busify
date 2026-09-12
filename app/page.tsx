import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

/**
 * The console has no marketing front door: `/` is wherever the caller belongs.
 * Signed-in staff land on Quotes, which is where the working day starts;
 * everyone else goes to the sign-in page.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? "/quotes" : "/login");
}
