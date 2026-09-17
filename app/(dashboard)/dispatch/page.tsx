import type { Metadata } from "next";

import { CalendarBoard, type CalendarCell } from "@/components/dispatch/calendar-board";
import { CalendarNav, MiniCalendar } from "@/components/dispatch/calendar-nav";
import { DispatchFilterRail } from "@/components/dispatch/filter-rail";
import { requireSession } from "@/lib/auth/session";
import {
  daysCovered,
  miniMonth,
  monthGrid,
  monthLabel,
  resolveMonth,
  shiftMonth,
} from "@/lib/calendar";
import { civilDate } from "@/lib/date-filters";
import {
  filterValue,
  only,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { getDispatchTrips, tripEnd } from "@/lib/queries/dispatch";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dispatch" };

const STATUS_VALUES = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ASSIGNMENT_OPTIONS = [
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "PARTIAL", label: "Partially assigned" },
  { value: "ASSIGNED", label: "Assigned" },
];

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { organization } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);
  const zone = organization.timezone;

  const { year, month } = resolveMonth(filterValue(params, "month"), zone);
  const grid = monthGrid(year, month, zone);
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const [todayYear, todayMonth] = civilDate(new Date(), zone);

  const supabase = await createClient();
  const [{ data: drivers }, { data: vehicles }, { data: types }, { data: garages }] =
    await Promise.all([
      supabase.from("drivers").select("id, first_name, last_name").order("first_name").limit(300),
      supabase.from("vehicles").select("id, name").order("name").limit(300),
      supabase.from("vehicle_types").select("id, name").order("name").limit(100),
      supabase.from("garages").select("id, name").order("name").limit(100),
    ]);

  const statuses = only([filterValue(params, "status") ?? ""], STATUS_VALUES);
  const trips = await getDispatchTrips(grid.rangeStart, grid.rangeEnd, {
    status: statuses.length ? statuses : undefined,
    assignment: filterValue(params, "assignment"),
    driverId: filterValue(params, "driver"),
    vehicleId: filterValue(params, "vehicle"),
    vehicleTypeId: filterValue(params, "vehicleType"),
    garageId: filterValue(params, "garage"),
  });

  const term = params.q.toLowerCase();
  const visible = term
    ? trips.filter((trip) =>
        [trip.reference, trip.company, trip.contact, trip.pickupLocation, trip.destination]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term)),
      )
    : trips;

  // A multi-day charter lands on every square it covers, not just its first.
  // The first square it touches is the job starting; the rest are marked as
  // continuations so three days of one charter never read as three bookings.
  const byDay = new Map<string, string[]>();
  const continuedOn = new Map<string, string[]>();

  for (const trip of visible) {
    const keys = daysCovered(trip.departureAt, tripEnd(trip).toISOString(), zone);
    keys.forEach((key, index) => {
      byDay.set(key, [...(byDay.get(key) ?? []), trip.id]);
      if (index > 0) {
        continuedOn.set(key, [...(continuedOn.get(key) ?? []), trip.id]);
      }
    });
  }

  const cells: CalendarCell[] = grid.days.map((day) => ({
    day,
    tripIds: byDay.get(day.key) ?? [],
    continuing: continuedOn.get(day.key) ?? [],
  }));

  return (
    <div className="flex gap-5">
      <aside className="hidden w-[200px] shrink-0 space-y-5 lg:block">
        <MiniCalendar
          days={miniMonth(year, month, zone)}
          label={monthLabel(year, month)}
          previousMonth={`${previous.year}-${String(previous.month).padStart(2, "0")}`}
          nextMonth={`${next.year}-${String(next.month).padStart(2, "0")}`}
        />

        <DispatchFilterRail
          statuses={STATUS_OPTIONS}
          assignments={ASSIGNMENT_OPTIONS}
          drivers={(drivers ?? []).map((driver) => ({
            value: driver.id,
            label: [driver.first_name, driver.last_name].filter(Boolean).join(" "),
          }))}
          vehicles={(vehicles ?? []).map((vehicle) => ({
            value: vehicle.id,
            label: vehicle.name,
          }))}
          vehicleTypes={(types ?? []).map((type) => ({
            value: type.id,
            label: type.name,
          }))}
          garages={(garages ?? []).map((garage) => ({
            value: garage.id,
            label: garage.name,
          }))}
        />
      </aside>

      <div className="min-w-0 flex-1">
        <CalendarNav
          label={monthLabel(year, month)}
          previousMonth={`${previous.year}-${String(previous.month).padStart(2, "0")}`}
          nextMonth={`${next.year}-${String(next.month).padStart(2, "0")}`}
          todayMonth={`${todayYear}-${String(todayMonth).padStart(2, "0")}`}
        />

        <CalendarBoard
          cells={cells}
          trips={visible}
          timeZone={zone}
          currency={organization.currency}
        />
      </div>
    </div>
  );
}
