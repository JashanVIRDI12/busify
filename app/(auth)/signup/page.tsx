import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getMemberships, getUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account" };

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    const memberships = await getMemberships();
    redirect(memberships.length > 0 ? "/quotes" : "/onboarding");
  }

  return (
    <AuthCard
      title="Create your account"
      description="You will set up your charter company in the next step."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-interactive hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
