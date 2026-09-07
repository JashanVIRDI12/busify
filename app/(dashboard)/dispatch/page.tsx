import type { Metadata } from "next";
import Link from "next/link";

import { CalendarNav, MiniCalendar } from "@/components/dispatch/calendar-nav";
import { DispatchFilterRail } from "@/components/dispatch/filter-rail";
import { requireSession } from "@/lib/auth/session";
import {
  WEEKDAYS,
  daysCovered,
  miniMonth,
  monthGrid,
  monthLabel,
  resolveMonth,
  shiftMonth,
} from "@/lib/calendar";
import { civilDate } from "@/lib/date-filters";
import { formatStampTime } from "@/lib/datetime";
import { filterValue, parseListParams, type SearchParamsInput } from "@/lib/list-params";
import { getDispatchTrips, tripEnd } from "@/lib/queries/dispatch";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispatch" };

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

  const status = filterValue(params, "status");
  const trips = await getDispatchTrips(grid.rangeStart, grid.rangeEnd, {
    status: status ? [status] : undefined,
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
  const byDay = new Map<string, typeof visible>();
  for (const trip of visible) {
    for (const key of daysCovered(
      trip.departureAt,
      tripEnd(trip).toISOString(),
      zone,
    )) {
      const bucket = byDay.get(key) ?? [];
      bucket.push(trip);
      byDay.set(key, bucket);
    }
  }

  const showNotes = filterValue(params, "notes") !== "off";

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

        <div className="overflow-hidden rounded-lg border border-bone bg-signal-white">
          <div className="grid grid-cols-7 border-b border-bone bg-teal-50/60">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2.5 text-center text-[12.5px] font-medium text-carbon"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.days.map((day) => {
              const dayTrips = byDay.get(day.key) ?? [];
              return (
                <div
                  key={day.key}
                  className={cn(
                    "min-h-[124px] border-r border-b border-bone p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                    !day.inMonth && "bg-mist/60",
                  )}
                >
                  <div className="mb-1 flex justify-center">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[12.5px]",
                        day.isToday
                          ? "bg-teal-100 font-semibold text-teal-700"
                          : day.inMonth
                            ? "text-carbon"
                            : "text-fog",
                      )}
                    >
                      {day.dayOfMonth}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {dayTrips.slice(0, 3).map((trip) => (
                      <Link
                        key={`${day.key}-${trip.id}`}
                        href={`/reservations/${trip.id}`}
                        className={cn(
                          "block truncate rounded px-1.5 py-1 text-[11.5px] leading-tight transition-opacity hover:opacity-85",
                          trip.assignmentStatus === "ASSIGNED"
                            ? "bg-teal-500 text-signal-white"
                            : trip.assignmentStatus === "PARTIAL"
                              ? "bg-amber/85 text-ink"
                              : "bg-orange-100 text-orange-700",
                        )}
                        title={`${trip.reference ?? ""} ${trip.pickupLocation} → ${trip.destination}`}
                      >
                        <span className="tabular font-medium">
                          {formatStampTime(trip.departureAt, zone)}
                        </span>{" "}
                        {trip.reference ?? trip.pickupLocation}
                        {showNotes && trip.groupName && (
                          <span className="block truncate opacity-80">
                            {trip.groupName}
                          </span>
                        )}
                      </Link>
                    ))}

                    {dayTrips.length > 3 && (
                      <Link
                        href={`/reservations?pickup=${day.key}`}
                        className="block px-1.5 text-[11px] font-medium text-teal-600 hover:underline"
                      >
                        +{dayTrips.length - 3} more
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
