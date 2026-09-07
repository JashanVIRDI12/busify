import type { Metadata } from "next";

import { signOutAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access" };

/**
 * Where an authenticated user lands when their account is not a member of the
 * organization.
 *
 * Multi-tenant Busify sent this case to `/onboarding` so the user could create
 * their own organization. Here there is exactly one organization and nobody
 * self-serves into it, so the honest answer is that an administrator has to add
 * them — not a form that would create a second tenant.
 */
export default function NoAccessPage() {
  return (
    <AuthCard
      title="No access yet"
      description="Your account is signed in, but it has not been added to an organization yet."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ask an administrator to add your account to the organization, then
          sign in again. If you think this is a mistake, check that you used the
          right email address.
        </p>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
