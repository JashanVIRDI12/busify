"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type FilterTab = {
  label: string;
  value: string | null;
  count?: number;
};

/** Nav pill strip: compact, fully rounded, subtle fill on hover. */
export function FilterTabs({
  tabs,
  paramName = "status",
}: {
  tabs: FilterTab[];
  paramName?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName);

  return (
    <div
      className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5"
      role="tablist"
      aria-label="Filter by status"
    >
      {tabs.map((tab) => {
        const active = current === tab.value || (!current && tab.value === null);

        const params = new URLSearchParams(searchParams.toString());
        if (tab.value) params.set(paramName, tab.value);
        else params.delete(paramName);
        const query = params.toString();

        return (
          <Link
            key={tab.label}
            href={query ? `${pathname}?${query}` : pathname}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-body-sm font-semibold transition-colors duration-150 outline-none",
              active ? "bg-ink text-signal-white" : "text-slate hover:bg-ink/4 hover:text-ink",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "tabular text-[12px] font-medium",
                  active ? "text-signal-white/60" : "text-ash",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
