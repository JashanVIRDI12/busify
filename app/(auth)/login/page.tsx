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
      description="Pick up where your operation left off."
      footer={
        <>
          New to Busify AI?{" "}
          <Link href="/signup" className="font-medium text-interactive hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} initialError={error} />
    </AuthCard>
  );
}
