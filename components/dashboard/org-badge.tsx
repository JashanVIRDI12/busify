import { ROLE_LABELS } from "@/lib/permissions";
import { initialsOf } from "@/lib/utils";
import type { OrgRole, Tables } from "@/types/database";

export function OrgBadge({
  organization,
  role,
}: {
  organization: Tables<"organizations">;
  role: OrgRole;
}) {
  return (
    <div className="mx-3 flex items-center gap-3 rounded-xl border border-bone bg-mist px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-signal-white">
        {initialsOf(...organization.name.split(/\s+/))}
      </span>
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold text-ink capitalize">
          {organization.name}
        </p>
        <p className="truncate text-[12px] text-ash">{ROLE_LABELS[role]}</p>
      </div>
    </div>
  );
}
