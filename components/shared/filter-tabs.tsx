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
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors duration-150 outline-none",
              active
                ? "border-orange-500 bg-orange-500 text-signal-white"
                : "border-orange-300 bg-signal-white text-orange-600 hover:bg-orange-50",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "tabular text-[12px] font-medium",
                  active ? "text-signal-white/70" : "text-orange-400",
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
