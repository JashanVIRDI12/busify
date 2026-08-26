"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_GROUPS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-7 px-3 py-5" aria-label="Main">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="meta-label px-3 pb-2">{group.label}</p>

          {group.items.map((item) => {
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <span
                  key={item.href}
                  aria-disabled
                  title="Coming in a later phase"
                  className="flex cursor-not-allowed items-center gap-3 rounded-full px-3 py-2 text-body-sm text-fog"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-ash">
                    Soon
                  </span>
                </span>
              );
            }

            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Nav items are pills too — one relentless radius everywhere.
                  "flex items-center gap-3 rounded-full px-3 py-2 text-body-sm font-semibold transition-colors duration-150 outline-none",
                  active
                    ? "bg-ink text-signal-white"
                    : "text-slate hover:bg-ink/4 hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-signal-white" : "text-ash",
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
