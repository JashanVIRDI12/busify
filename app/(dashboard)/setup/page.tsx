import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { requireSession } from "@/lib/auth/session";
import { getSetupProgress } from "@/lib/queries/setup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up your company" };

/**
 * Where a new operator lands after creating their organization.
 *
 * Onboarding used to drop them straight into an empty Quotes list, which is a
 * screen with nothing on it and no indication of what to do next — and the
 * quote builder would have priced everything at zero anyway, because no rate
 * card existed. This is the missing middle: the handful of things that have to
 * be true before the product can do its job, each one a link.
 */
export default async function SetupPage() {
  const { organization } = await requireSession();
  const setup = await getSetupProgress(organization);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="meta-label">Welcome to Busify</p>
      <h1 className="mt-3 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance text-onyx sm:text-[40px]">
        {setup.isComplete
          ? `${organization.name} is ready to go`
          : `Let's get ${organization.name} set up`}
      </h1>
      <p className="mt-3 max-w-xl text-body text-pretty text-slate">
        {setup.isComplete
          ? "Everything is in place. This page stays here if you ever want to check."
          : "Work through these in any order. You can leave and come back — your progress is worked out from what is actually in the system, not remembered from a wizard."}
      </p>

      <div className="mt-8">
        <SetupChecklist setup={setup} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-2 text-body-sm font-semibold text-interactive hover:underline"
        >
          Skip for now and go to Quotes
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/guide"
          className="text-body-sm font-medium text-slate hover:text-ink hover:underline"
        >
          Read the guide
        </Link>
      </div>
    </div>
  );
}
