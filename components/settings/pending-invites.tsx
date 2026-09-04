"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

import { revokeInvitationAction } from "@/app/(dashboard)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleFormState } from "@/lib/forms";
import { ROLE_LABELS } from "@/lib/permissions";
import type { OrgRole } from "@/types/database";

export type PendingInvite = {
  id: string;
  email: string;
  role: OrgRole;
  created_at: string;
};

export function PendingInvites({
  invites,
  canManage,
}: {
  invites: PendingInvite[];
  canManage: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function revoke(id: string) {
    setPendingId(id);
    const formData = new FormData();
    formData.set("id", id);
    const result = await revokeInvitationAction(idleFormState, formData);
    setPendingId(null);
    if (result.status === "error") {
      toast.error(result.message ?? "Could not revoke that invitation.");
    } else {
      toast.success(result.message ?? "Invitation revoked.");
    }
  }

  return (
    <div className="border-t border-border">
      <p className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
        Pending invitations
      </p>
      <ul className="divide-y divide-border">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Mail className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {invite.email}
              </span>
              <span className="block text-xs text-muted-foreground">
                Invited {formatDistanceToNow(new Date(invite.created_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[invite.role]}</Badge>
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Revoke invitation for ${invite.email}`}
                disabled={pendingId === invite.id}
                onClick={() => revoke(invite.id)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
