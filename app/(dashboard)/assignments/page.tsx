import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import {
  ResourceToggle,
  TimelineControls,
} from "@/components/dispatch/timeline-controls";
import {
  SCALES,
  Timeline,
  TimelineLegend,
  type TimelineScale,
} from "@/components/dispatch/timeline";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { civilDate, zonedMidnight } from "@/lib/date-filters";
import {
  buildDriverTimeline,
  buildVehicleTimeline,
} from "@/lib/dispatch-timeline";
import { filterValue, parseListParams, type SearchParamsInput } from "@/lib/list-params";
import { getDispatchTrips, getFleetRows } from "@/lib/queries/dispatch";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { organization } = await requireSession();
  const params = parseListParams(await searchParams);
  const zone = organization.timezone;

  const scale = resolveScale(filterValue(params, "scale"));
  const resource = filterValue(params, "resource") === "driver" ? "driver" : "vehicle";

  const startDate = resolveStartDate(filterValue(params, "date"), zone);
  const [year, month, day] = startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const windowStart = zonedMidnight(year, month, day, zone);
  const windowEnd = zonedMidnight(year, month, day + SCALES[scale].days, zone);

  const supabase = await createClient();
  const [trips, fleet, { data: driverRows }] = await Promise.all([
    getDispatchTrips(windowStart, windowEnd),
    getFleetRows(),
    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("status", "ACTIVE")
      .order("first_name")
      .limit(300),
  ]);

  const drivers = (driverRows ?? []).map((driver) => ({
    id: driver.id,
    name: [driver.first_name, driver.last_name].filter(Boolean).join(" "),
  }));

  const timeline =
    resource === "driver"
      ? buildDriverTimeline(trips, drivers)
      : buildVehicleTimeline(trips, fleet);

  return (
    <div className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-heading-sm font-semibold text-ink">Assignments</h1>

        <TimelineControls startDate={startDate} scale={scale} />

        <div className="ml-auto flex items-center gap-2.5">
          <ResourceToggle resource={resource} />
          <Button asChild>
            <Link href="/reservations?assignment=UNASSIGNED">
              <CalendarClock />
              View {timeline.unassigned} Unassigned
            </Link>
          </Button>
        </div>
      </div>

      {timeline.groups.length === 0 ? (
        <p className="rounded-lg border border-bone bg-mist px-4 py-10 text-center text-body-sm text-slate">
          {resource === "driver"
            ? "No active drivers yet. Add drivers to see their schedule here."
            : "No vehicles yet. Add coaches to your fleet to see the board."}
        </p>
      ) : (
        <Timeline
          groups={timeline.groups}
          bars={timeline.bars}
          windowStart={windowStart}
          scale={scale}
          timeZone={zone}
        />
      )}

      <TimelineLegend />
    </div>
  );
}

function resolveScale(value: string | null): TimelineScale {
  return value === "12h" || value === "48h" || value === "1w" ? value : "24h";
}

/** `YYYY-MM-DD`, defaulting to today in the operator's timezone. */
function resolveStartDate(value: string | null, timeZone: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = civilDate(new Date(), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
