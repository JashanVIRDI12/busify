import { formatStampDate, formatStampTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type TripStop = Tables<"trip_stops">;

type StopEvent = { type: string; at: string | null };

/** The operator's own movements, which bracket the customer's trip. */
function isYard(stop: TripStop): boolean {
  return stop.kind === "GARAGE_OUT" || stop.kind === "GARAGE_IN";
}

/**
 * What happens at a stop, in the order it happens.
 *
 * The events are derived from the stop's position on the run rather than
 * stored, because they are not independent facts: the first stop is a pickup
 * *because* it is first, and a stop the coach returns to is a dropoff and a
 * pickup at the same address. Storing the labels as well as the order would
 * let the two disagree, and one of them would then be wrong.
 */
function eventsFor(stop: TripStop): StopEvent[] {
  switch (stop.kind) {
    case "GARAGE_OUT":
      return [
        { type: "Arrive", at: stop.arrive_at },
        { type: "Depart", at: stop.depart_at },
      ];
    case "GARAGE_IN":
      return [{ type: "Return", at: stop.arrive_at }];
    case "PICKUP":
      return [
        { type: "Pickup", at: stop.arrive_at },
        { type: "Depart", at: stop.depart_at },
      ];
    case "DROPOFF":
      return [{ type: "Dropoff", at: stop.arrive_at }];
    default:
      // A stop in the middle: the group gets off, and later gets back on.
      return [
        { type: "Dropoff", at: stop.arrive_at },
        ...(stop.board_at ? [{ type: "Pickup", at: stop.board_at }] : []),
        { type: "Depart", at: stop.depart_at },
      ];
  }
}

/**
 * Times read as a date and a time on the first event of a stop, and as a bare
 * time on the ones that follow — because they are the same day, and repeating
 * the date on every line makes the column impossible to scan.
 */
function stamp(
  at: string | null,
  timeZone: string,
  previous: string | null,
): string {
  if (!at) return "--";

  const time = formatStampTime(at, timeZone);
  const sameDay =
    previous !== null &&
    formatStampDate(at, timeZone) === formatStampDate(previous, timeZone);

  return sameDay ? time : `${formatStampDate(at, timeZone)} · ${time}`;
}

/**
 * The reservation's route, stop by stop.
 *
 * Read top to bottom it is the driver's day: out of the yard, round the stops,
 * back to the yard. The yard rows are marked "G" and greyed because they are
 * the operator's own movements — the customer's trip is the numbered part.
 */
export function StopTimeline({
  stops,
  timeZone,
  renderNotes,
}: {
  stops: TripStop[];
  timeZone: string;
  /** Lets the page attach an editor without this component owning state. */
  renderNotes?: (stop: TripStop) => React.ReactNode;
}) {
  if (stops.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-cloud bg-mist/40 px-6 py-8 text-center text-body-sm text-slate">
        This reservation has no stops recorded. Ones converted from a quote
        carry its itinerary; a job entered straight onto the board does not.
      </p>
    );
  }

  // Numbering counts only the customer's stops, so the yard does not consume a
  // number and "Stop 2" means the second place the group actually goes.
  //
  // Counted rather than accumulated: a running total mutated while rendering is
  // read at a different value if React re-runs the pass. Quadratic, over a
  // handful of stops, which is free.
  const numbers = stops.map((stop, index) =>
    isYard(stop)
      ? null
      : stops.slice(0, index + 1).filter((entry) => !isYard(entry)).length,
  );

  return (
    <ol className="divide-y divide-bone">
      {stops.map((stop, index) => {
        const number = numbers[index];
        const events = eventsFor(stop);

        return (
          <li
            key={stop.id}
            className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-3 py-4"
          >
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  isYard(stop)
                    ? "bg-mercury text-slate"
                    : "bg-teal-500 text-signal-white",
                )}
              >
                {number ?? "G"}
              </span>

              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">
                  {stop.label?.trim() || stop.address?.trim() || "Stop"}
                </p>
                {/* The address only repeats under the name when it adds
                    something the name did not already say. */}
                {stop.address && stop.address.trim() !== stop.label?.trim() && (
                  <p className="mt-0.5 text-body-sm text-slate">
                    {stop.address}
                  </p>
                )}
                {renderNotes?.(stop)}
              </div>
            </div>

            <div className="space-y-1">
              {events.map((event) => (
                <p
                  key={event.type}
                  className="text-body-sm font-medium text-teal-600"
                >
                  {event.type}
                </p>
              ))}
            </div>

            <div className="space-y-1 text-right">
              {events.map((event, position) => {
                // The most recent earlier event that actually has a time; the
                // date is printed only when this one falls on a different day.
                const earlier =
                  events
                    .slice(0, position)
                    .map((entry) => entry.at)
                    .filter((at): at is string => Boolean(at))
                    .at(-1) ?? null;

                return (
                  <p
                    key={event.type}
                    className="tabular text-body-sm whitespace-nowrap text-slate"
                  >
                    {stamp(event.at, timeZone, earlier)}
                  </p>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
