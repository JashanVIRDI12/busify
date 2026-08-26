"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, UserMinus } from "lucide-react";
import { toast } from "sonner";

import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(dashboard)/settings/actions";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idleFormState } from "@/lib/forms";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import type { OrgRole } from "@/types/database";

export function MemberRoleSelect({
  memberId,
  role,
  disabled,
  canPromoteToOwner,
}: {
  memberId: string;
  role: OrgRole;
  disabled: boolean;
  canPromoteToOwner: boolean;
}) {
  const [value, setValue] = useState<OrgRole>(role);
  const [pending, startTransition] = useTransition();

  const options: OrgRole[] = canPromoteToOwner
    ? ["OWNER", ...ASSIGNABLE_ROLES]
    : [...ASSIGNABLE_ROLES];

  // An existing OWNER must stay selectable even when the viewer is an ADMIN,
  // otherwise the Select renders with no matching option.
  if (value === "OWNER" && !options.includes("OWNER")) options.unshift("OWNER");

  function handleChange(next: string) {
    const previous = value;
    const nextRole = next as OrgRole;
    if (nextRole === previous) return;

    setValue(nextRole);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("memberId", memberId);
      formData.set("role", nextRole);

      const result = await updateMemberRoleAction(idleFormState, formData);

      if (result.status === "error") {
        // The database refused the change — show what is actually stored.
        setValue(previous);
        toast.error(result.message ?? "Could not update that role.");
      } else {
        toast.success(result.message ?? "Role updated.");
      }
    });
  }

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled || pending}
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {ROLE_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MemberRowActions({
  memberId,
  displayName,
  disabled,
}: {
  memberId: string;
  displayName: string;
  disabled: boolean;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);

  if (disabled) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${displayName}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setRemoveOpen(true)}
          >
            <UserMinus />
            Remove from organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        id={memberId}
        action={removeMemberAction}
        title={`Remove ${displayName}?`}
        description="They lose access to this organization immediately. Their account stays, and you can invite them again later."
        successMessage="Member removed."
      />
    </>
  );
}
