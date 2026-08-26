/**
 * Timezone handling for trip times.
 *
 * Departure and return times are entered as wall-clock time in the
 * organization's time zone ("06:00 on 20 September, Toronto time") but stored as
 * `timestamptz`. Naively posting a `datetime-local` value would make Postgres
 * read it as UTC, putting an Indian 06:00 departure at 11:30 local.
 *
 * No dependency needed: Intl already knows every zone's offset, including
 * historical DST rules.
 */

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

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

  // Intl renders midnight as hour 24 in some engines.
  const hour = lookup.hour === 24 ? 0 : (lookup.hour ?? 0);

  const asUtc = Date.UTC(
    lookup.year ?? 1970,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    hour,
    lookup.minute ?? 0,
    lookup.second ?? 0,
  );

  return asUtc - instant.getTime();
}

/**
 * "2026-09-20T06:00" in America/Toronto → "2026-09-20T10:00:00.000Z".
 *
 * Two passes: the first offset is looked up at the wrong instant, which only
 * matters within an hour of a DST transition. Re-resolving with the corrected
 * instant converges.
 */
export function zonedTimeToUtc(localValue: string, timeZone: string): string | null {
  const match = DATETIME_LOCAL.exec(localValue.trim());
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  const asUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? "0"),
  );

  let timestamp = asUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    timestamp = asUtc - offsetMs(new Date(timestamp), timeZone);
  }

  const result = new Date(timestamp);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

/** Inverse of the above — fills a `datetime-local` input from stored UTC. */
export function utcToZonedInputValue(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";

  const local = new Date(instant.getTime() + offsetMs(instant, timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(
  iso: string | null,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!iso) return "—";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(instant);
}

export function formatDate(iso: string | null, timeZone: string): string {
  return formatDateTime(iso, timeZone, {
    hour: undefined,
    minute: undefined,
    hour12: undefined,
  });
}

export function formatTime(iso: string | null, timeZone: string): string {
  return formatDateTime(iso, timeZone, {
    day: undefined,
    month: undefined,
    year: undefined,
  });
}

/** "in 18 days", "tomorrow", "3 days ago" — for scanning a list quickly. */
export function relativeDays(iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";

  const days = Math.round(
    (target.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * A request without a return date still occupies a vehicle. Assume a single
 * day so availability checks have a window to compare against.
 */
export function tripWindow(departureAt: string, returnAt: string | null) {
  const start = new Date(departureAt);
  const end = returnAt ? new Date(returnAt) : new Date(start.getTime() + 86_400_000);
  return { start, end };
}
