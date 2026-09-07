"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useListParams } from "@/lib/hooks/use-list-params";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/lib/calendar";

/** Month stepper, search and the Today reset, above the calendar grid. */
export function CalendarNav({
  label,
  previousMonth,
  nextMonth,
  todayMonth,
}: {
  label: string;
  previousMonth: string;
  nextMonth: string;
  todayMonth: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { get, setParams } = useListParams();
  const [term, setTerm] = useState(get("q"));
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      setParams({ q: term.trim() || null });
    }, 320);
    return () => clearTimeout(timer);
  }, [term, setParams]);

  function monthHref(month: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", month);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <StepLink href={monthHref(previousMonth)} label="Previous month">
          <ChevronLeft className="size-4" />
        </StepLink>
        <StepLink href={monthHref(nextMonth)} label="Next month">
          <ChevronRight className="size-4" />
        </StepLink>
      </div>

      <h2 className="text-subheading font-semibold text-ink">{label}</h2>

      <div className="relative flex h-10 w-full max-w-[280px] items-center rounded-md border border-cloud bg-signal-white transition-colors focus-within:border-orange-400">
        <Search className="pointer-events-none absolute left-3 size-[15px] text-ash" />
        <input
          value={term}
          onChange={(event) => {
            dirty.current = true;
            setTerm(event.target.value);
          }}
          placeholder="Search"
          aria-label="Search reservations"
          className="h-full w-full bg-transparent pr-3 pl-9 text-body-sm text-ink outline-none placeholder:text-ash"
        />
      </div>

      <Button variant="outline" size="sm" className="ml-auto h-9" asChild>
        <Link href={monthHref(todayMonth)}>Today</Link>
      </Button>
    </div>
  );
}

function StepLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-cloud bg-signal-white text-carbon transition-colors hover:border-fog hover:bg-mist"
    >
      {children}
    </Link>
  );
}

/**
 * The rail's month picker. Clicking a day filters the grid to that day rather
 * than navigating away — the big grid stays the thing you are looking at.
 */
export function MiniCalendar({
  days,
  label,
  previousMonth,
  nextMonth,
}: {
  days: CalendarDay[];
  label: string;
  previousMonth: string;
  nextMonth: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function monthHref(month: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", month);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-body-sm font-semibold text-ink">{label}</p>
        <span className="flex items-center gap-1">
          <StepLink href={monthHref(previousMonth)} label="Previous month">
            <ChevronLeft className="size-3.5" />
          </StepLink>
          <StepLink href={monthHref(nextMonth)} label="Next month">
            <ChevronRight className="size-3.5" />
          </StepLink>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            className="text-[11px] font-medium text-ash"
          >
            {initial}
          </span>
        ))}

        {days.map((day) => (
          <span
            key={day.key}
            className={cn(
              "mx-auto flex size-6 items-center justify-center rounded-full text-[11.5px]",
              day.isToday && "bg-teal-100 font-semibold text-teal-700",
              !day.inMonth && "text-fog",
              day.inMonth && !day.isToday && "text-carbon",
            )}
          >
            {day.dayOfMonth}
          </span>
        ))}
      </div>
    </div>
  );
}
