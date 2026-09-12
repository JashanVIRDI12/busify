import { civilDate, zonedMidnight } from "@/lib/date-filters";

/**
 * Calendar geometry for the dispatch views.
 *
 * Every boundary here is midnight *in the operator's timezone*, not UTC and not
 * the server's zone. A Vancouver operator's Tuesday runs from 08:00 UTC Tuesday
 * to 08:00 UTC Wednesday, and a grid built on UTC days would show their 5pm
 * departures on the wrong square for a third of the year.
 */

export type CalendarDay = {
  /** `YYYY-MM-DD` in the operator's timezone. */
  key: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  /** UTC instants bounding this local day. */
  start: Date;
  end: Date;
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parses `YYYY-MM`, falling back to the current month in `timeZone`. */
export function resolveMonth(
  value: string | null | undefined,
  timeZone: string,
  now = new Date(),
): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const [year, month] = civilDate(now, timeZone);
  return { year, month };
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Which weekday (0 = Sunday) the first of the month falls on. */
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/**
 * Six weeks of days, always — the grid never changes height between months,
 * which is what stops the whole page reflowing when an operator pages through
 * the year.
 */
export function monthGrid(
  year: number,
  month: number,
  timeZone: string,
  now = new Date(),
): { days: CalendarDay[]; rangeStart: Date; rangeEnd: Date } {
  const lead = firstWeekday(year, month);
  const [todayYear, todayMonth, todayDay] = civilDate(now, timeZone);
  const todayKey = dayKey(todayYear, todayMonth, todayDay);

  const days: CalendarDay[] = [];

  for (let cell = 0; cell < 42; cell += 1) {
    // Offset from the 1st; negative values roll into the previous month, which
    // `Date.UTC` normalises for us.
    const offset = cell - lead;
    const civil = new Date(Date.UTC(year, month - 1, 1 + offset));
    const cellYear = civil.getUTCFullYear();
    const cellMonth = civil.getUTCMonth() + 1;
    const cellDay = civil.getUTCDate();

    const start = zonedMidnight(cellYear, cellMonth, cellDay, timeZone);
    const end = zonedMidnight(cellYear, cellMonth, cellDay + 1, timeZone);
    const key = dayKey(cellYear, cellMonth, cellDay);

    days.push({
      key,
      dayOfMonth: cellDay,
      inMonth: cellMonth === month && cellYear === year,
      isToday: key === todayKey,
      start,
      end,
    });
  }

  return {
    days,
    rangeStart: days[0]!.start,
    rangeEnd: days[days.length - 1]!.end,
  };
}

/** The compact month used by the calendar's left rail. */
export function miniMonth(
  year: number,
  month: number,
  timeZone: string,
  now = new Date(),
): CalendarDay[] {
  return monthGrid(year, month, timeZone, now).days.slice(
    0,
    // Trailing all-blank weeks waste vertical space in a 200px rail.
    Math.ceil((firstWeekday(year, month) + daysInMonth(year, month)) / 7) * 7,
  );
}

/**
 * Splits a UTC instant range into the local day keys it touches, so a
 * multi-day charter appears on every square it actually occupies.
 */
export function daysCovered(
  startIso: string,
  endIso: string | null,
  timeZone: string,
  cap = 60,
): string[] {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];

  const end = endIso ? new Date(endIso) : start;
  const keys: string[] = [];

  let [year, month, day] = civilDate(start, timeZone);
  for (let index = 0; index < cap; index += 1) {
    const key = dayKey(year, month, day);
    keys.push(key);

    const next = zonedMidnight(year, month, day + 1, timeZone);
    if (next.getTime() > end.getTime()) break;

    [year, month, day] = civilDate(next, timeZone);
  }

  return keys;
}
