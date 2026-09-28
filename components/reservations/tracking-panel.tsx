import { Navigation } from "lucide-react";

import { StopNotes } from "@/components/reservations/stop-notes";
import {
  StopTimeline,
  type TripStop,
} from "@/components/reservations/stop-timeline";
import { TripMap, type MapPoint } from "@/components/reservations/trip-map";
import { Button } from "@/components/ui/button";
import { formatSpan } from "@/lib/datetime";
import type { StopLeg } from "@/lib/queries/reservation-tabs";
import { formatDistance } from "@/lib/utils";

/**
 * Turn-by-turn in the operator's own Google Maps, from the yard round every
 * stop and back. Google's URL scheme takes nine waypoints, which covers any
 * charter this product prices.
 */
function directionsUrl(points: MapPoint[]): string | null {
  if (points.length < 2) return null;
  const at = (point: MapPoint) => `${point.lat},${point.lng}`;

  const params = new URLSearchParams({
    api: "1",
    origin: at(points[0]!),
    destination: at(points[points.length - 1]!),
    travelmode: "driving",
  });
  const between = points.slice(1, -1).slice(0, 9);
  if (between.length > 0) params.set("waypoints", between.map(at).join("|"));

  return `https://www.google.com/maps/dir/?${params}`;
}

/**
 * Planned against actual, for the figures a charter is billed and run on.
 *
 * Actual is blank until a coach reports where it went. Shown anyway, and said
 * plainly, because the gap is the point: an operator looking here wants to know
 * whether the job ran as sold, and a card that appears only once there is
 * tracking data hides the fact that there is none.
 */
function PlanVsActual({
  plannedMiles,
  plannedMinutes,
  plannedDays,
  yardToYardMinutes,
}: {
  plannedMiles: number;
  plannedMinutes: number;
  plannedDays: number;
  yardToYardMinutes: number;
}) {
  const rows = [
    { label: "Distance", planned: plannedMiles > 0 ? formatDistance(plannedMiles) : null },
    { label: "Driving", planned: plannedMinutes > 0 ? formatSpan(plannedMinutes) : null },
    { label: "Yard to yard", planned: yardToYardMinutes > 0 ? formatSpan(yardToYardMinutes) : null },
    { label: "Days", planned: plannedDays > 0 ? String(plannedDays) : null },
  ];

  return (
    <section aria-labelledby="plan-heading" className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="plan-heading" className="text-body-sm font-semibold text-ink">
          Planned vs actual
        </h2>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate">
          <span className="size-1.5 rounded-full bg-fog" aria-hidden="true" />
          Not tracking
        </span>
      </div>

      <table className="mt-3 w-full text-body-sm">
        <caption className="sr-only">
          Planned and actual distance, time and days for this reservation
        </caption>
        <thead>
          <tr className="text-[11px] text-slate">
            <th scope="col" className="pb-1.5 text-left font-medium">
              <span className="sr-only">Measure</span>
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Planned
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Actual
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-bone">
              <th scope="row" className="py-2 text-left font-normal text-slate">
                {row.label}
              </th>
              <td className="tabular py-2 text-right font-medium text-ink">
                {row.planned ?? "--"}
              </td>
              <td className="tabular py-2 text-right text-fog">--</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[12px] text-pretty text-slate">
        Actuals fill in once a coach reports its position.
      </p>
    </section>
  );
}

/**
 * Where the coach is going, and how that compares to what was sold.
 *
 * The itinerary leads — it is what a dispatcher reads — and the map and the
 * figures ride alongside it, pinned while a long itinerary scrolls past. Nothing
 * here is live: tracking a vehicle needs a vehicle reporting its position, and
 * there is no source of that yet, so the panel says so rather than drawing a
 * coach at its pickup and implying it is sitting there.
 */
export function TrackingPanel({
  points,
  stops,
  legs,
  timeZone,
  canEdit,
  plannedMiles,
  plannedMinutes,
  plannedDays,
  yardToYardMinutes,
}: {
  points: MapPoint[];
  stops: TripStop[];
  legs: Record<number, StopLeg>;
  timeZone: string;
  canEdit: boolean;
  plannedMiles: number;
  plannedMinutes: number;
  plannedDays: number;
  yardToYardMinutes: number;
}) {
  const directions = directionsUrl(points);
  const customerStops = stops.filter(
    (stop) => stop.kind !== "GARAGE_OUT" && stop.kind !== "GARAGE_IN",
  ).length;
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
      <section aria-labelledby="itinerary-heading" className="panel p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="itinerary-heading" className="text-body font-semibold text-ink">
            Itinerary
          </h2>
          <p className="tabular text-[12px] text-slate">
            {customerStops} {customerStops === 1 ? "stop" : "stops"}
            {plannedMiles > 0 && ` · ${formatDistance(plannedMiles)}`} · {city} time
          </p>
        </div>

        <StopTimeline
          stops={stops}
          legs={legs}
          timeZone={timeZone}
          renderNotes={(stop) => (
            <StopNotes stopId={stop.id} notes={stop.notes} canEdit={canEdit} />
          )}
        />
      </section>

      <div className="space-y-5 lg:sticky lg:top-[calc(var(--topnav-height)+1.25rem)]">
        <section aria-labelledby="route-heading" className="panel overflow-hidden">
          <TripMap points={points} />
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="route-heading" className="text-body-sm font-semibold text-ink">
                Route
              </h2>
              {directions && (
                <Button variant="outline" size="sm" asChild>
                  <a href={directions} target="_blank" rel="noreferrer">
                    <Navigation className="size-3.5" aria-hidden="true" />
                    Directions
                    <span className="sr-only"> in Google Maps (opens a new tab)</span>
                  </a>
                </Button>
              )}
            </div>
            {points.length > 0 && (
              <p className="mt-1 text-[12px] text-pretty text-slate">
                Grey pins are the yard; numbers match the itinerary.
              </p>
            )}
          </div>
        </section>

        <PlanVsActual
          plannedMiles={plannedMiles}
          plannedMinutes={plannedMinutes}
          plannedDays={plannedDays}
          yardToYardMinutes={yardToYardMinutes}
        />
      </div>
    </div>
  );
}
