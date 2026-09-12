"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_NAV } from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

/**
 * Settings navigation.
 *
 * `/settings` is the General page *and* the section root, so it can only match
 * exactly — a `startsWith` test would light it up on every page in here.
 */
export function SettingsRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings">
      <p className="mb-5 text-subheading font-semibold text-ink">Settings</p>

      {SETTINGS_NAV.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="mb-1.5 text-body font-medium text-ink">{group.label}</p>

          {group.items.map((item) => {
            const active =
              item.href === "/settings"
                ? pathname === "/settings"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-body-sm transition-colors",
                  active
                    ? "bg-orange-50 font-medium text-orange-600"
                    : "text-teal-600 hover:bg-mist",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
