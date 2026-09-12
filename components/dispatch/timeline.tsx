import Link from "next/link";

import { civilDate, zonedMidnight } from "@/lib/date-filters";
import { cn } from "@/lib/utils";

/**
 * The dispatch timeline.
 *
 * Rows are resources (a coach, or a driver); bars are the reservations they are
 * committed to. Everything is laid out from a single `hourWidth`, so the same
 * component draws a two-day board and a one-week overview without a second set
 * of measurements.
 *
 * Bars are positioned in *elapsed hours from the window start*, computed on
 * real instants. Deliberately not in local hours: a board spanning a DST change
 * has a 23- or 25-hour day, and laying out on wall-clock hours would silently
 * shift every bar after the transition by an hour.
 */

export const ROW_HEIGHT = 25;
export const GROUP_HEIGHT = 26;

export type TimelineBar = {
  id: string;
  rowId: string;
  label: string;
  href?: string;
  start: string;
  end: string;
  /** Minutes of turnaround drawn as an outlined tail after the bar. */
  bufferMinutes?: number;
  tone: "confirmed" | "draft" | "blocked" | "conflict";
  /** Small count badge, e.g. the number of vehicles on the reservation. */
  badge?: number;
};

export type TimelineRow = { id: string; label: string; meta?: string };
export type TimelineGroup = { id: string; label: string; rows: TimelineRow[] };

export type TimelineScale = "12h" | "24h" | "48h" | "1w";

export const SCALES: Record<
  TimelineScale,
  { label: string; days: number; hourWidth: number }
> = {
  "12h": { label: "12 hours", days: 1, hourWidth: 74 },
  "24h": { label: "24 hours", days: 2, hourWidth: 38 },
  "48h": { label: "48 hours", days: 3, hourWidth: 24 },
  "1w": { label: "1 week", days: 7, hourWidth: 12 },
};

const TONES: Record<TimelineBar["tone"], string> = {
  confirmed: "bg-teal-500 text-signal-white",
  draft: "border border-dashed border-teal-400 bg-teal-50 text-teal-700",
  blocked: "bg-cloud text-carbon",
  conflict: "bg-amber text-ink",
};

export function Timeline({
  groups,
  bars,
  windowStart,
  scale,
  timeZone,
  labelWidth = 168,
  now = new Date(),
  hourWidth: hourWidthOverride,
  days: daysOverride,
}: {
  groups: TimelineGroup[];
  bars: TimelineBar[];
  windowStart: Date;
  scale: TimelineScale;
  timeZone: string;
  labelWidth?: number;
  now?: Date;
  /** Overrides the scale's geometry, for the narrow board panel. */
  hourWidth?: number;
  days?: number;
}) {
  const days = daysOverride ?? SCALES[scale].days;
  const hourWidth = hourWidthOverride ?? SCALES[scale].hourWidth;
  const totalHours = days * 24;
  const width = totalHours * hourWidth;
  const startMs = windowStart.getTime();

  /** Elapsed hours from the window start, clamped to the drawn range. */
  const hoursFrom = (iso: string) =>
    (new Date(iso).getTime() - startMs) / 3_600_000;

  const barsByRow = new Map<string, TimelineBar[]>();
  for (const bar of bars) {
    const bucket = barsByRow.get(bar.rowId) ?? [];
    bucket.push(bar);
    barsByRow.set(bar.rowId, bucket);
  }

  // Day boundaries are recomputed per day rather than added in 24h steps, so a
  // DST day is 23 or 25 hours wide and the dates stay over the right columns.
  const dayBands: { label: string; left: number; width: number }[] = [];
  let cursor = windowStart;
  for (let index = 0; index < days; index += 1) {
    const [year, month, day] = civilDate(cursor, timeZone);
    const next = zonedMidnight(year, month, day + 1, timeZone);
    const left = hoursFrom(cursor.toISOString()) * hourWidth;
    const end = Math.min(hoursFrom(next.toISOString()), totalHours);
    dayBands.push({
      label: new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor),
      left,
      width: end * hourWidth - left,
    });
    cursor = next;
  }

  const nowOffset = hoursFrom(now.toISOString());
  const nowVisible = nowOffset >= 0 && nowOffset <= totalHours;

  return (
    <div className="flex overflow-hidden rounded-lg border border-bone bg-signal-white">
      {/* Resource column. Sticky rather than scrolling with the timeline: the
          row label is the one thing you must be able to read at any scroll. */}
      <div
        className="shrink-0 border-r border-bone"
        style={{ width: labelWidth }}
      >
        <div
          className="border-b border-bone bg-mist"
          style={{ height: GROUP_HEIGHT + 18 }}
        />
        {groups.map((group) => (
          <div key={group.id}>
            <div
              className="flex items-center border-b border-bone bg-violet-100/40 px-3 text-[12px] font-semibold text-violet-500"
              style={{ height: GROUP_HEIGHT }}
            >
              {group.label}
            </div>
            {group.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 border-b border-bone px-3 text-[12px] text-carbon"
                style={{ height: ROW_HEIGHT }}
              >
                {row.meta && (
                  <span className="tabular text-[11px] text-ash">{row.meta}</span>
                )}
                <span className="truncate font-medium text-ink">{row.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="scrollbar-slim min-w-0 flex-1 overflow-x-auto">
        <div style={{ width }} className="relative">
          {/* Header: day bands over hour ticks */}
          <div
            className="relative border-b border-bone bg-mist"
            style={{ height: GROUP_HEIGHT + 18 }}
          >
            {dayBands.map((band) => (
              <span
                key={band.label + band.left}
                className="absolute top-1 rounded bg-violet-500/90 px-1.5 py-0.5 text-[10.5px] font-medium text-signal-white"
                style={{ left: band.left + 4 }}
              >
                {band.label}
              </span>
            ))}

            {Array.from({ length: totalHours }, (_, hour) => (
              <span
                key={hour}
                className="absolute bottom-0.5 text-[9.5px] text-ash"
                style={{ left: hour * hourWidth + 2 }}
              >
                {hourTick(hour, hourWidth)}
              </span>
            ))}
          </div>

          {/* Hour gridlines, drawn once behind every row. */}
          <div className="absolute inset-x-0 top-[44px] bottom-0 -z-0">
            {Array.from({ length: totalHours + 1 }, (_, hour) => (
              <span
                key={hour}
                className={cn(
                  "absolute top-0 bottom-0 border-l",
                  hour % 24 === 0 ? "border-cloud" : "border-bone/70",
                )}
                style={{ left: hour * hourWidth }}
              />
            ))}
          </div>

          {groups.map((group) => (
            <div key={group.id} className="relative">
              <div
                className="border-b border-bone bg-violet-100/40"
                style={{ height: GROUP_HEIGHT }}
              />
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="relative border-b border-bone"
                  style={{ height: ROW_HEIGHT }}
                >
                  {(barsByRow.get(row.id) ?? []).map((bar) => {
                    const left = hoursFrom(bar.start) * hourWidth;
                    const right = hoursFrom(bar.end) * hourWidth;
                    const bufferWidth =
                      ((bar.bufferMinutes ?? 0) / 60) * hourWidth;

                    // Clip to the window instead of dropping: a charter that
                    // started yesterday should still show as occupying today.
                    const clippedLeft = Math.max(0, left);
                    const clippedRight = Math.min(width, right + bufferWidth);
                    if (clippedRight <= 0 || clippedLeft >= width) return null;

                    const barWidth = Math.max(
                      6,
                      Math.min(width, right) - clippedLeft,
                    );

                    return (
                      <BarShape
                        key={bar.id}
                        bar={bar}
                        left={clippedLeft}
                        width={barWidth}
                        bufferWidth={Math.max(
                          0,
                          clippedRight - clippedLeft - barWidth,
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          {nowVisible && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-[44px] bottom-0 border-l-2 border-violet-500"
              style={{ left: nowOffset * hourWidth }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BarShape({
  bar,
  left,
  width,
  bufferWidth,
}: {
  bar: TimelineBar;
  left: number;
  width: number;
  bufferWidth: number;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-full items-center justify-center gap-1 overflow-hidden rounded-[3px] px-1 text-[10.5px] font-medium whitespace-nowrap",
          TONES[bar.tone],
        )}
        style={{ width }}
      >
        {width > 44 && bar.label}
        {width > 68 && bar.badge !== undefined && (
          <span className="rounded-full bg-signal-white/25 px-1 text-[9.5px]">
            {bar.badge}
          </span>
        )}
      </span>
      {bufferWidth > 2 && (
        <span
          aria-hidden
          className="h-full rounded-r-[3px] border border-l-0 border-cloud bg-signal-white"
          style={{ width: bufferWidth }}
        />
      )}
    </>
  );

  const className = "absolute top-[3px] bottom-[3px] flex";
  const style = { left } as const;

  if (!bar.href) {
    return (
      <span className={className} style={style} title={bar.label}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={bar.href}
      className={cn(className, "transition-opacity hover:opacity-85")}
      style={style}
      title={bar.label}
    >
      {content}
    </Link>
  );
}

/** Hour labels thin out as the scale tightens, so ticks never collide. */
function hourTick(hour: number, hourWidth: number): string {
  const local = hour % 24;
  if (local === 6) return "6A";
  if (local === 12) return "12P";
  if (local === 18) return "6P";
  if (local === 0) return "12A";
  if (hourWidth >= 38) return String(local % 12 === 0 ? 12 : local % 12);
  if (hourWidth >= 24 && local % 3 === 0) {
    return String(local % 12 === 0 ? 12 : local % 12);
  }
  return "";
}

export function TimelineLegend() {
  const items = [
    { label: "Confirmed Reservation", className: "bg-teal-500" },
    { label: "Buffer Time", className: "border border-cloud bg-signal-white" },
    { label: "Draft", className: "border border-dashed border-teal-400 bg-teal-50" },
    { label: "Blocked", className: "bg-cloud" },
    { label: "Schedule Conflict", className: "bg-amber" },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-slate">
          <span className={cn("size-2.5 rounded-[2px]", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
