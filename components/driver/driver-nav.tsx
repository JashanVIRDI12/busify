"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, LogOut, Route, UserRound } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Trips", href: "/driver", icon: Route },
  { label: "Schedule", href: "/driver/schedule", icon: CalendarDays },
  { label: "Documents", href: "/driver/documents", icon: FileText },
  { label: "Profile", href: "/driver/profile", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/driver") return pathname === "/driver";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DriverNav({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-bone bg-signal-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
        <Link href="/driver" className="rounded-xl outline-none">
          <Logo />
        </Link>

        <nav
          className="ml-auto flex items-center gap-1 overflow-x-auto"
          aria-label="Driver"
        >
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-body-sm font-semibold transition-colors outline-none",
                  active
                    ? "bg-ink text-signal-white"
                    : "text-slate hover:bg-ink/4 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}

          <form action={signOutAction.bind(null, "/driver/login")}>
            <button
              type="submit"
              aria-label="Sign out"
              title={`Sign out ${name}`}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-body-sm font-semibold text-slate transition-colors outline-none hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
