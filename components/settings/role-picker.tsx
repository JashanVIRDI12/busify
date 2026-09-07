"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { setMemberRoleAction } from "@/app/(dashboard)/settings/user-actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/types/database";

/**
 * The Type column, editable in place.
 *
 * Ownership is only offered when the person changing it is themselves an owner
 * — the server enforces that too, but showing an option that will be refused is
 * worse than not showing it at all.
 */
export function RolePicker({
  memberId,
  role,
  canEdit,
  canAssignOwner,
}: {
  memberId: string;
  role: OrgRole;
  canEdit: boolean;
  canAssignOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!canEdit) return <span>{ROLE_LABELS[role]}</span>;

  const options: OrgRole[] = [
    ...(canAssignOwner ? (["OWNER"] as OrgRole[]) : []),
    "ADMIN",
    "DISPATCHER",
    "STAFF",
    "ACCOUNTANT",
    "DRIVER",
  ];

  return (
    <Popover>
      <PopoverTrigger
        disabled={pending}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-mist disabled:opacity-60"
      >
        {ROLE_LABELS[role]}
        <ChevronDown className="size-3.5 text-ash" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-48 p-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await setMemberRoleAction(memberId, option);
                if (result.ok) toast.success(`Now ${ROLE_LABELS[option]}`);
                else toast.error(result.message);
              })
            }
            className={cn(
              "w-full rounded-lg px-2.5 py-2 text-left text-body-sm transition-colors hover:bg-mist",
              option === role
                ? "bg-orange-50 font-medium text-orange-700"
                : "text-carbon",
            )}
          >
            {ROLE_LABELS[option]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
