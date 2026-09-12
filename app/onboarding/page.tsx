import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getMemberships, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your organization" };

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getMemberships();

  if (memberships.length > 0) redirect("/quotes");

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.split(" ")[0]
      : null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-orange-600 uppercase">
        Step 1 of 1
      </p>
      <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.035em] text-onyx text-balance">
        {fullName ? `Welcome, ${fullName}.` : "Welcome."} Let&rsquo;s set up your
        charter company.
      </h1>
      <p className="text-body-sm text-pretty text-slate">
        This becomes your organization. Everything you create afterwards —
        vehicles, drivers, customers, trips — belongs to it and is visible only
        to people you invite.
      </p>

      <div className="mt-8 rounded-2xl border border-bone bg-signal-white p-6 shadow-(--shadow-layered) sm:p-7">
        <OnboardingForm defaultEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
