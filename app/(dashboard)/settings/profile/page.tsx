import type { Metadata } from "next";

import { ProfileForm } from "@/components/settings/profile-form";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const { user, organization, role } = await requireSession();

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <>
      <h1 className="mb-4 text-heading-sm font-semibold text-ink">My Profile</h1>

      <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="panel p-5 sm:p-6">
          <h2 className="text-subheading font-semibold text-ink">Your details</h2>
          <p className="mt-1 mb-5 text-body-sm text-slate">
            The name your teammates see across the console, and on the quotes you
            send.
          </p>

          <ProfileForm fullName={fullName} email={user.email ?? ""} />
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="text-body-sm font-semibold text-ink">Your role</p>
            <p className="mt-1.5 inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[12px] font-medium text-orange-700">
              {ROLE_LABELS[role]}
            </p>
            <p className="mt-2.5 text-body-sm text-pretty text-slate">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          <div className="panel p-5">
            <p className="text-body-sm font-semibold text-ink">Organization</p>
            <p className="mt-1.5 text-body-sm text-carbon">{organization.name}</p>
            <p className="mt-2.5 text-[12.5px] text-slate">
              Only an owner or admin can change what your role is here. Ask one of
              them if you need more access.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
