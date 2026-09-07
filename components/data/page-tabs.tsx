import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation inside one page, driven by the URL so a tab is linkable and
 * the server renders the right one on first paint.
 */
export function PageTabs({
  tabs,
  active,
}: {
  tabs: { label: string; href: string; key: string }[];
  active: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-bone">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2 text-body-sm transition-colors",
              current
                ? "border-ink font-semibold text-ink"
                : "border-transparent text-slate hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
