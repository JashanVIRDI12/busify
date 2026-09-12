"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  CalendarCheck2,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/shell/brand-mark";
import { NAV, isEntryActive, type NavEntry } from "@/components/shell/nav-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, initialsOf } from "@/lib/utils";

type Props = {
  organizationName: string;
  userName: string | null;
  userEmail: string;
  roleLabel: string;
};

/**
 * The horizontal chrome every console page sits under. Active state is a soft
 * orange pill rather than an underline, which survives the menu entries whose
 * children are the thing actually selected.
 */
export function TopNav({
  organizationName,
  userName,
  userEmail,
  roleLabel,
}: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1 border-b border-bone bg-signal-white px-3 sm:px-5">
      <MobileNav pathname={pathname} />

      <Link href="/quotes" className="mr-3 shrink-0 rounded-md py-1 outline-none">
        <BrandMark />
      </Link>

      <nav className="hidden items-center gap-0.5 lg:flex">
        {NAV.map((entry) => (
          <NavEntryButton
            key={entry.label}
            entry={entry}
            active={isEntryActive(entry, pathname)}
          />
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-0.5">
        <IconLink href="/payments" label="Payments" icon={CreditCard} />
        <IconLink href="/dispatch" label="Dispatch calendar" icon={CalendarCheck2} />
        <IconLink href="/settings" label="Settings" icon={Settings} />
        <IconLink href="/guide" label="Help and guide" icon={CircleHelp} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1.5 flex h-10 items-center gap-2 rounded-full border border-cloud bg-signal-white pr-3 pl-1 transition-colors hover:border-fog"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-teal-500 text-[12px] font-semibold text-signal-white">
                {initialsOf(userName ?? userEmail)}
              </span>
              <span className="hidden max-w-[140px] truncate text-body-sm font-medium text-ink sm:block">
                {organizationName}
              </span>
              <ChevronDown className="size-4 text-ash" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <div className="px-2.5 py-2">
              <p className="truncate text-body-sm font-semibold text-ink">
                {userName ?? userEmail}
              </p>
              <p className="truncate text-[12px] text-ash">{userEmail}</p>
              <p className="mt-1.5 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                {roleLabel}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <UserRound className="size-4 text-ash" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4 text-ash" />
                Company Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-body-sm text-destructive transition-colors hover:bg-destructive/8"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function NavEntryButton({ entry, active }: { entry: NavEntry; active: boolean }) {
  const pill = cn(
    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-medium transition-colors",
    active
      ? "bg-orange-50 text-orange-600"
      : "text-carbon hover:bg-mist hover:text-ink",
  );

  if (entry.href && !entry.items) {
    return (
      <Link href={entry.href} className={pill}>
        {entry.label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={pill}>
        {entry.label}
        {entry.badge && (
          <span className="rounded-full bg-violet-100 px-1.5 py-[1px] text-[9px] font-semibold tracking-wide text-violet-500">
            {entry.badge}
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[19rem] p-1.5">
        {entry.items?.map((item) => (
          <DropdownMenuItem key={item.href} asChild className="items-start gap-2.5 py-2">
            <Link href={item.href}>
              {item.icon && (
                <item.icon className="mt-0.5 size-4 shrink-0 text-orange-500" />
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm font-medium text-ink">
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-[11.5px] leading-snug text-ash">
                    {item.description}
                  </span>
                )}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof CreditCard;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className="hidden size-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink sm:flex"
          aria-label={label}
        >
          <Icon className="size-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[17rem] p-0">
        <div className="border-b border-bone px-5 py-4">
          <SheetTitle asChild>
            <span>
              <BrandMark />
            </span>
          </SheetTitle>
        </div>

        <div className="overflow-y-auto px-3 py-4">
          {NAV.map((entry) => (
            <div key={entry.label} className="mb-3">
              {entry.items ? (
                <>
                  <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-ash uppercase">
                    {entry.label}
                  </p>
                  {entry.items.map((item) => (
                    <MobileLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={pathname.startsWith(item.href)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </>
              ) : (
                entry.href && (
                  <MobileLink
                    href={entry.href}
                    label={entry.label}
                    active={isEntryActive(entry, pathname)}
                    onNavigate={() => setOpen(false)}
                  />
                )
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "block rounded-lg px-3 py-2 text-body-sm font-medium transition-colors",
        active ? "bg-orange-50 text-orange-600" : "text-carbon hover:bg-mist",
      )}
    >
      {label}
    </Link>
  );
}
