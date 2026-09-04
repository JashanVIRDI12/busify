import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthCard } from "@/components/auth/auth-card";
import { getMemberships, landingPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accept your invitation" };

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The invite link signs the person in first; with no session it is stale.
  if (!user) {
    redirect("/login?error=That+invitation+link+has+expired.+Ask+for+a+new+one.");
  }

  // Already belongs somewhere and reopened the link — just send them home.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect(await landingPath());

  return (
    <AuthCard
      title="Accept your invitation"
      description="You've been invited to Busify. Choose the password you'll sign in with, and you're in."
      footer={
        <Link href="/login" className="font-medium text-interactive hover:underline">
          Back to sign in
        </Link>
      }
    >
      <AcceptInviteForm />
    </AuthCard>
  );
}
