import { ArrowUpRight, Hourglass, Route, Timer, Warehouse } from "lucide-react";

import { StatusPill } from "@/components/data/status-pill";
import {
  daysBetweenDates,
  formatDayLabel,
  formatSpan,
  formatStampTime,
  minutesBetween,
} from "@/lib/datetime";
import {
  RETURN_LEG_POSITION,
  type StopLeg,
} from "@/lib/queries/reservation-tabs";
import { cn, formatDistance } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type TripStop = Tables<"trip_stops">;

/** The pin label for the operator's yard, here and on the map. */
export const YARD_MARKER = "G";

/** The operator's own movements, which bracket the customer's trip. */
function isYard(stop: TripStop): boolean {
  return stop.kind === "GARAGE_OUT" || stop.kind === "GARAGE_IN";
}

/**
 * What each stop is called on the rail and on the map. The yard is G; the
 * customer's stops count 1, 2, 3, so "stop 2" means the second place the group
 * actually goes and the same pin on the map says 2.
 */
export function stopMarkers(stops: TripStop[]): string[] {
  let count = 0;
  return stops.map((stop) => (isYard(stop) ? YARD_MARKER : String(++count)));
}

const KIND: Record<TripStop["kind"], { tag: string; verb: string }> = {
  GARAGE_OUT: { tag: "Yard", verb: "leaves" },
  PICKUP: { tag: "Pickup", verb: "departs" },
  STOP: { tag: "Stop", verb: "arrives" },
  DROPOFF: { tag: "Drop-off", verb: "arrives" },
  GARAGE_IN: { tag: "Yard", verb: "back" },
};

/** The one instant a stop is known by: when it leaves, or when it arrives. */
function keyTime(stop: TripStop): string | null {
  return stop.kind === "GARAGE_OUT" || stop.kind === "PICKUP"
    ? (stop.depart_at ?? stop.arrive_at)
    : (stop.arrive_at ?? stop.depart_at);
}

/** Labels the builder gives by position, which name nothing on their own. */
const POSITIONAL_LABEL = /^(pick-?up|drop-?off|stop(\s+\d+)?)$/i;

/**
 * A stop's name and the rest of its address. A real label ("Ceremony") leads
 * with the full address under it; a positional one gives way to the street,
 * so the row says "22 Elm St" rather than "Pickup" twice.
 */
function placeOf(stop: TripStop): { name: string; detail: string | null } {
  const label = stop.label?.trim();
  const address = stop.address?.trim();

  if (label && !POSITIONAL_LABEL.test(label)) {
    return { name: label, detail: address && address !== label ? address : null };
  }
  if (address) {
    const [street, ...rest] = address.split(",");
    return { name: street!.trim(), detail: rest.join(",").trim() || null };
  }
  return { name: label || "Stop", detail: null };
}

/** The address itself, found by what Google called it when it was picked. */
function mapsSearchUrl(stop: TripStop): string | null {
  const query =
    stop.address?.trim() ||
    (stop.latitude !== null && stop.longitude !== null
      ? `${stop.latitude},${stop.longitude}`
      : "");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

/** `2026-10-03` on the operator's calendar, for counting days. */
function calendarDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function driveText(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  return safe < 60 ? `${safe} min` : formatSpan(safe);
}

/**
 * The reservation's route, stop by stop, down a single rail.
 *
 * Read top to bottom it is the driver's day: out of the yard, round the stops,
 * back in. Times run down the left so the day can be scanned as a column; each
 * drive sits on the rail between the two stops it joins; a wait sits on the
 * stop it happens at. The yard is drawn quieter than the customer's stops —
 * it is the operator's own movement, not part of what was sold.
 */
export function StopTimeline({
  stops,
  legs = {},
  timeZone,
  renderNotes,
}: {
  stops: TripStop[];
  /** Measured legs keyed by the stop position they arrive at. */
  legs?: Record<number, StopLeg>;
  timeZone: string;
  /** Lets the page attach an editor without this component owning state. */
  renderNotes?: (stop: TripStop) => React.ReactNode;
}) {
  if (stops.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-cloud bg-mist/60 px-6 py-8 text-center text-body-sm text-slate">
        This reservation has no stops recorded. Ones converted from a quote
        carry its itinerary; a job entered straight onto the board does not.
      </p>
    );
  }

  const markers = stopMarkers(stops);
  const times = stops.map(keyTime);
  const dates = times.map((at) => (at ? calendarDate(at, timeZone) : null));
  const firstDate = dates.find((date): date is string => Boolean(date)) ?? null;
  // Day headings only earn their space when the run crosses midnight.
  const multiDay = new Set(dates.filter(Boolean)).size > 1;

  return (
    <ol aria-label="Itinerary" className="text-body-sm">
      {stops.map((stop, index) => {
        const kind = KIND[stop.kind];
        const place = placeOf(stop);
        const mapsUrl = mapsSearchUrl(stop);
        const yard = isYard(stop);
        const first = index === 0;
        const last = index === stops.length - 1;

        const at = times[index] ?? null;
        const date = dates[index] ?? null;
        const newDay = multiDay && date && (first || date !== dates[index - 1]);
        const dayNumber =
          newDay && firstDate ? (daysBetweenDates(firstDate, date) ?? 0) + 1 : null;

        // The drive into this stop, as Google measured it for the quote.
        const leg = first
          ? undefined
          : legs[stop.kind === "GARAGE_IN" ? RETURN_LEG_POSITION : stop.position];
        // Time the timestamps say passed beyond that drive: a night in Ottawa,
        // or a coach sent early. Only shown when it is more than rounding.
        const previous = stops[index - 1];
        const gap =
          previous && leg && at
            ? minutesBetween(previous.depart_at ?? previous.arrive_at ?? at, at) -
              leg.minutes
            : 0;
        const drove = leg && (leg.km >= 0.05 || leg.minutes > 0);
        const standby = gap > 45 ? gap : 0;

        const wait =
          stop.kind === "STOP" && stop.arrive_at && stop.depart_at
            ? minutesBetween(stop.arrive_at, stop.depart_at)
            : 0;
        const spot =
          stop.kind === "PICKUP" &&
          stop.arrive_at &&
          stop.depart_at &&
          stop.arrive_at !== stop.depart_at
            ? stop.arrive_at
            : null;

        const secondary =
          wait > 0 && stop.depart_at
            ? `to ${formatStampTime(stop.depart_at, timeZone)}`
            : kind.verb;

        return (
          <li
            key={stop.id}
            className="grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5.25rem_1.5rem_minmax(0,1fr)]"
          >
            {newDay && (
              <>
                <span aria-hidden="true" />
                <Rail line={!first} />
                <p className="pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate uppercase">
                  {formatDayLabel(at, timeZone)}
                  {dayNumber ? ` · Day ${dayNumber}` : ""}
                </p>
              </>
            )}

            {(drove || standby > 0) && (
              <>
                <span aria-hidden="true" />
                <Rail line />
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-[12px] text-slate">
                  {drove && (
                    <span className="inline-flex items-center gap-1.5">
                      <Route className="size-3.5 text-ash" aria-hidden="true" />
                      <span className="tabular">
                        {driveText(leg!.minutes)} · {formatDistance(leg!.km)}
                      </span>
                    </span>
                  )}
                  {standby > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Hourglass className="size-3.5 text-ash" aria-hidden="true" />
                      <span className="tabular">{formatSpan(standby)} standing by</span>
                    </span>
                  )}
                </p>
              </>
            )}

            <div className="pt-2.5 text-right">
              <p className="tabular font-semibold whitespace-nowrap text-ink">
                {at ? formatStampTime(at, timeZone) : "--"}
              </p>
              <p className="tabular text-[11px] whitespace-nowrap text-slate">
                {secondary}
              </p>
            </div>

            <div className="relative flex justify-center" aria-hidden="true">
              {!first && (
                <span className="absolute top-0 left-1/2 h-5 w-px -translate-x-1/2 bg-cloud" />
              )}
              {!last && (
                <span className="absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-cloud" />
              )}
              <span
                className={cn(
                  "relative mt-2 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                  yard
                    ? "border border-cloud bg-signal-white text-slate"
                    : "bg-teal-500 text-signal-white",
                )}
              >
                {yard ? <Warehouse className="size-3.5" /> : markers[index]}
              </span>
            </div>

            <div className={cn("min-w-0 pt-2.5", last ? "pb-1" : "pb-4")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold text-ink">{place.name}</h3>
                <StatusPill label={kind.tag} className="px-2 py-px text-[10.5px]" />
              </div>

              {place.detail &&
                (mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${stop.address ?? place.detail}, open in Google Maps`}
                    className="group mt-0.5 block max-w-full rounded-sm text-[12.5px] text-slate transition-colors hover:text-teal-700"
                  >
                    <span className="underline-offset-2 group-hover:underline">
                      {place.detail}
                    </span>
                    {/* Inline, so a wrapped address carries it after its last word
                        instead of pinning it to the far edge. */}
                    <ArrowUpRight
                      className="ml-1 inline-block size-3 align-[-1px] text-ash transition-colors group-hover:text-teal-600"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <p className="mt-0.5 text-[12.5px] text-slate">{place.detail}</p>
                ))}

              {(spot || wait > 0) && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {spot && (
                    <Fact icon={<Timer />}>Spot {formatStampTime(spot, timeZone)}</Fact>
                  )}
                  {wait > 0 && <Fact icon={<Hourglass />}>Waits {formatSpan(wait)}</Fact>}
                </ul>
              )}

              {renderNotes && <div>{renderNotes(stop)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One segment of the vertical line joining the stops. */
function Rail({ line }: { line: boolean }) {
  return (
    <div className="relative" aria-hidden="true">
      {line && (
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-cloud" />
      )}
    </div>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="tabular inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[11.5px] text-carbon [&_svg]:size-3 [&_svg]:text-slate">
      {icon}
      {children}
    </li>
  );
}
