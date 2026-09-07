/**
 * Date filters on the console lists.
 *
 * A filter value is either a preset key ("future", "next-3") or a plain
 * `YYYY-MM-DD`. Presets are resolved on the server, at request time, against the
 * operator's own timezone — resolving them in the browser would put a Vancouver
 * dispatcher's "today" three hours off a Toronto operator's books.
 */

export const DATE_PRESETS = [
  { key: "future", label: "In the Future" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "next-3", label: "Next 3 Days" },
  { key: "next-7", label: "Next 7 Days" },
  { key: "this-month", label: "This Month" },
  { key: "past", label: "In the Past" },
] as const;

export type DatePresetKey = (typeof DATE_PRESETS)[number]["key"];

export type DateRange = { gte?: string; lte?: string };

/** Milliseconds a zone is ahead of UTC at a given instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }

  const hour = lookup.hour === 24 ? 0 : (lookup.hour ?? 0);

  return (
    Date.UTC(
      lookup.year ?? 1970,
      (lookup.month ?? 1) - 1,
      lookup.day ?? 1,
      hour,
      lookup.minute ?? 0,
      lookup.second ?? 0,
    ) - instant.getTime()
  );
}

/** The calendar date in `timeZone` at `instant`, as [year, month, day]. */
function civilDate(instant: Date, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }

  return [lookup.year ?? 1970, lookup.month ?? 1, lookup.day ?? 1];
}

/** Midnight local to `timeZone` on the given civil date, as a UTC instant. */
function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  let timestamp = naive;
  // Two passes converge across a DST boundary; see lib/datetime.ts.
  for (let pass = 0; pass < 2; pass += 1) {
    timestamp = naive - offsetMs(new Date(timestamp), timeZone);
  }
  return new Date(timestamp);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Turn a filter value into an inclusive-start, exclusive-end instant pair ready
 * for `.gte()` / `.lt()` on a timestamptz column.
 */
export function resolveDateRange(
  value: string | null | undefined,
  timeZone: string,
  now = new Date(),
): DateRange | null {
  if (!value) return null;

  const [year, month, day] = civilDate(now, timeZone);
  const todayStart = zonedMidnight(year, month, day, timeZone);

  switch (value) {
    case "future":
      return { gte: now.toISOString() };
    case "past":
      return { lte: now.toISOString() };
    case "today":
      return {
        gte: todayStart.toISOString(),
        lte: addDays(todayStart, 1).toISOString(),
      };
    case "tomorrow":
      return {
        gte: addDays(todayStart, 1).toISOString(),
        lte: addDays(todayStart, 2).toISOString(),
      };
    case "next-3":
      return {
        gte: todayStart.toISOString(),
        lte: addDays(todayStart, 3).toISOString(),
      };
    case "next-7":
      return {
        gte: todayStart.toISOString(),
        lte: addDays(todayStart, 7).toISOString(),
      };
    case "this-month": {
      const monthStart = zonedMidnight(year, month, 1, timeZone);
      const nextMonth =
        month === 12
          ? zonedMidnight(year + 1, 1, 1, timeZone)
          : zonedMidnight(year, month + 1, 1, timeZone);
      return { gte: monthStart.toISOString(), lte: nextMonth.toISOString() };
    }
    default: {
      // A literal YYYY-MM-DD: the whole of that day in the operator's zone.
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) return null;
      const start = zonedMidnight(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        timeZone,
      );
      return { gte: start.toISOString(), lte: addDays(start, 1).toISOString() };
    }
  }
}
