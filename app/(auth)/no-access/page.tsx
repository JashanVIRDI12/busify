import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access" };

/**
 * Fallback when an authenticated user has no organization membership and did
 * not go through `/onboarding`. The usual path now sends them there to create
 * one; this page remains for anyone who lands on the old URL.
 */
export default function NoAccessPage() {
  return (
    <AuthCard
      title="No access yet"
      description="Your account is signed in, but it has not been added to an organization yet."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set up your charter company, or ask an administrator to add this
          email to an existing organization.
        </p>

        <Button asChild className="w-full">
          <Link href="/onboarding">Set up your company</Link>
        </Button>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
