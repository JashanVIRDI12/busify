import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Logo } from "@/components/shared/logo";
import { getMemberships, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your organization" };

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getMemberships();

  // Already onboarded — nothing to do here.
  if (memberships.length > 0) redirect("/dashboard");

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.split(" ")[0]
      : null;

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
      />

      <header className="relative px-6 py-6">
        <Logo />
      </header>

      <main className="relative mx-auto w-full max-w-2xl px-6 pb-24">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-interactive uppercase">
            Step 1 of 1
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {fullName ? `Welcome, ${fullName}.` : "Welcome."} Let&rsquo;s set up your
            charter company.
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            This becomes your organization. Everything you create afterwards —
            vehicles, drivers, customers, trips — belongs to it and is visible only
            to people you invite.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-(--shadow-layered) sm:p-7">
          <OnboardingForm defaultEmail={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
