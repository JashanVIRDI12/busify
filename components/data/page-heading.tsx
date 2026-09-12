import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

/**
 * Title, result count, saved views and the page's one primary action, all on a
 * single line. The count sits beside the title rather than under it because it
 * is the number an operator re-reads after every filter change.
 */
export function PageHeading({
  title,
  count,
  countLabel = "Results",
  views,
  actions,
  className,
}: {
  title: string;
  count?: number | null;
  countLabel?: string;
  views?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <h1 className="text-heading-sm font-semibold text-ink">{title}</h1>

      {typeof count === "number" && (
        <p className="tabular text-[12.5px] font-medium text-slate">
          {formatNumber(count)} {countLabel}
        </p>
      )}

      {views}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
