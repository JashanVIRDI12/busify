import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Driver sign in" };

export default async function DriverLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex rounded-xl outline-none">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pt-4 pb-20 sm:items-center sm:pt-0 sm:pb-24">
        <div className="w-full max-w-[26rem]">
          <AuthCard
            title="Driver sign in"
            description="Your trips, your schedule, your documents — all in one place."
            footer={
              <>
                Not a driver?{" "}
                <Link
                  href="/login"
                  className="font-medium text-interactive hover:underline"
                >
                  Staff sign in
                </Link>
              </>
            }
          >
            <LoginForm next="/driver" initialError={error} />
          </AuthCard>
        </div>
      </main>
    </div>
  );
}
