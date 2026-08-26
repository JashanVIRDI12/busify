import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, organization, role } = await requireSession();

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your profile, and the organization you are working in."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>
                This is the name your teammates see across the dashboard.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileForm fullName={fullName} email={user.email ?? ""} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Your role</CardTitle>
                <CardDescription>{ROLE_LABELS[role]}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-pretty">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </CardContent>
          </Card>

          <Link
            href="/settings/organization"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Building2 className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{organization.name}</span>
              <span className="block text-xs text-muted-foreground">
                Organization details and team
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
