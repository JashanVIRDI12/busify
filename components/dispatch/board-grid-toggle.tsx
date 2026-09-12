"use client";

import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useListParams } from "@/lib/hooks/use-list-params";

/**
 * The board's right-hand grid can be switched off entirely, which is what a
 * dispatcher does when they are working the table on a laptop screen. The
 * external-link icon opens the same view as the full-width Assignments page.
 */
export function BoardGridToggle({
  gridOn,
  assignmentsHref,
}: {
  gridOn: boolean;
  assignmentsHref: string;
}) {
  const { setParams } = useListParams();

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        aria-label="Board settings"
        className="flex size-8 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink"
      >
        <Settings2 className="size-[18px]" />
      </Link>

      <Switch
        checked={gridOn}
        onCheckedChange={(next) => setParams({ grid: next ? null : "off" })}
        aria-label="Show the assignment grid"
        className="data-[state=checked]:bg-teal-500"
      />
      <span className="text-body-sm font-medium text-ink">Grid</span>

      <Link
        href={assignmentsHref}
        aria-label="Open the full assignments timeline"
        className="flex size-8 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink"
      >
        <ExternalLink className="size-[18px]" />
      </Link>
    </div>
  );
}
