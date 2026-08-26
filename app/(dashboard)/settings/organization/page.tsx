import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  MemberRoleSelect,
  MemberRowActions,
} from "@/components/settings/member-row-actions";
import { BookingLink } from "@/components/settings/booking-link";
import { OrganizationForm } from "@/components/settings/organization-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { canManage, isOwner, ROLE_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { initialsOf } from "@/lib/utils";
import type { OrgRole } from "@/types/database";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrganizationSettingsPage() {
  const { user, organization, role } = await requireSession();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .order("created_at");

  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const manageAllowed = canManage(role);
  const ownerCount = (members ?? []).filter((m) => m.role === "OWNER").length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/settings">
          <ArrowLeft />
          Back to settings
        </Link>
      </Button>

      <PageHeader
        eyebrow={organization.slug}
        title={organization.name}
        description="Company details customers see on quotes, and the people who can act on this organization's data."
      />

      {!manageAllowed && (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            You are signed in as {ROLE_LABELS[role]}. Only owners and admins can
            change these settings.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Company details</CardTitle>
            <CardDescription>
              Currency and timezone apply to every quote, booking and trip time in
              this organization.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            organization={organization}
            disabled={!manageAllowed}
          />
        </CardContent>
      </Card>

      <BookingLink url={`${siteUrl()}/book/${organization.slug}`} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              Roles map directly onto database policies — a Driver cannot write
              records even if the interface were to offer it.
            </CardDescription>
          </div>
          <Badge variant="muted">
            {members?.length ?? 0} {members?.length === 1 ? "member" : "members"}
          </Badge>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => {
                const profile = profileById.get(member.user_id);
                const isSelf = member.user_id === user.id;
                const displayName =
                  profile?.full_name?.trim() || profile?.email || "Teammate";

                // The last owner is locked so the organization can never be
                // orphaned; the database enforces the same rule.
                const lastOwner = member.role === "OWNER" && ownerCount <= 1;

                return (
                  <TableRow key={member.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {initialsOf(...displayName.split(/[\s@.]+/))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {displayName}
                            {isSelf && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {profile?.email ?? "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {manageAllowed && !lastOwner ? (
                        <MemberRoleSelect
                          memberId={member.id}
                          role={member.role as OrgRole}
                          disabled={false}
                          canPromoteToOwner={isOwner(role)}
                        />
                      ) : (
                        <Badge variant="secondary">
                          {ROLE_LABELS[member.role as OrgRole]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <MemberRowActions
                        memberId={member.id}
                        displayName={displayName}
                        disabled={!manageAllowed || isSelf || lastOwner}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <p className="border-t border-border px-5 py-3.5 text-sm text-muted-foreground">
            Inviting teammates by email arrives in a later phase. Roles and removal
            work today.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
