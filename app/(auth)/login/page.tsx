import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthCard
      title="Sign in"
      description="Charter operations, from quote to dispatch."
      // Staff accounts are created by an administrator, not self-service —
      // there is no signup route to link to.
      footer={
        <>
          Need access?{" "}
          <Link
            href="/"
            className="font-medium text-interactive hover:underline"
          >
            Contact your administrator
          </Link>
        </>
      }
    >
      <LoginForm next={next} initialError={error} />
    </AuthCard>
  );
}
