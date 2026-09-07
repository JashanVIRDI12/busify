import type { Metadata } from "next";
import Link from "next/link";

import { BoardGridToggle } from "@/components/dispatch/board-grid-toggle";
import { Timeline } from "@/components/dispatch/timeline";
import { TimelineControls } from "@/components/dispatch/timeline-controls";
import {
  ClearFiltersButton,
  MultiFilter,
  SearchField,
  SingleFilter,
} from "@/components/data/filters";
import { StatusPill, TRIP_STATUS, pillFor } from "@/components/data/status-pill";
import {
  Blank,
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCard,
} from "@/components/data/table";
import { requireSession } from "@/lib/auth/session";
import {
  buildDriverTimeline,
  buildVehicleTimeline,
} from "@/lib/dispatch-timeline";
import { civilDate, zonedMidnight } from "@/lib/date-filters";
import { formatStampTime } from "@/lib/datetime";
import {
  filterValue,
  only,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { getDispatchTrips, getFleetRows } from "@/lib/queries/dispatch";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispatch board" };

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

/**
 * One day of work, twice: as a table you can read every field of, and as a grid
 * you can see the gaps in. They are the same rows — the grid is not a summary,
 * it is the same query drawn against a clock.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { organization } = await requireSession();
  const params = parseListParams(await searchParams, { defaultPer: 50 });
  const zone = organization.timezone;

  const startDate = resolveStartDate(filterValue(params, "date"), zone);
  const [year, month, day] = startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const windowStart = zonedMidnight(year, month, day, zone);
  const windowEnd = zonedMidnight(year, month, day + 1, zone);

  const gridOn = filterValue(params, "grid") !== "off";

  const supabase = await createClient();
  const [{ data: garages }, { data: types }] = await Promise.all([
    supabase.from("garages").select("id, name").order("name").limit(100),
    supabase.from("vehicle_types").select("id, name").order("name").limit(100),
  ]);

  const statuses = only(params.filters.status, STATUS_VALUES);

  const [trips, fleet, { data: driverRows }] = await Promise.all([
    getDispatchTrips(windowStart, windowEnd, {
      status: statuses.length ? [...statuses] : undefined,
      assignment: filterValue(params, "assignment"),
      garageId: filterValue(params, "garage"),
      vehicleTypeId: filterValue(params, "vehicleType"),
    }),
    getFleetRows(),
    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("status", "ACTIVE")
      .order("first_name")
      .limit(300),
  ]);

  const term = params.q.toLowerCase();
  const rows = term
    ? trips.filter((trip) =>
        [trip.reference, trip.company, trip.contact, trip.groupName, trip.pickupLocation]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term)),
      )
    : trips;

  const drivers = (driverRows ?? []).map((driver) => ({
    id: driver.id,
    name: [driver.first_name, driver.last_name].filter(Boolean).join(" "),
  }));

  const vehicleTimeline = buildVehicleTimeline(rows, fleet);
  const driverTimeline = buildDriverTimeline(rows, drivers);

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
  }).format(windowStart);

  return (
    <div className="panel p-4">
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <h1 className="mr-1 text-subheading font-semibold text-ink">{dayLabel}</h1>

        <TimelineControls startDate={startDate} scale="12h" onDaysToShift={1} />

        <SearchField placeholder={`Search ${rows.length} Results`} />
        <MultiFilter paramKey="status" label="Res. Status" options={STATUS_OPTIONS} />
        <SingleFilter
          paramKey="assignment"
          label="Assignment"
          options={ASSIGNMENT_OPTIONS}
        />
        <SingleFilter
          paramKey="garage"
          label="Garage"
          options={(garages ?? []).map((garage) => ({
            value: garage.id,
            label: garage.name,
          }))}
        />
        <SingleFilter
          paramKey="vehicleType"
          label="Vehicle Type"
          options={(types ?? []).map((type) => ({
            value: type.id,
            label: type.name,
          }))}
        />
        <ClearFiltersButton />

        <div className="ml-auto">
          <BoardGridToggle
            gridOn={gridOn}
            assignmentsHref={`/assignments?date=${startDate}`}
          />
        </div>
      </div>

      <div className={cn("flex gap-4", !gridOn && "block")}>
        <div className="min-w-0 flex-1">
          <TableCard
            footer={
              <p className="text-[12.5px] text-slate">
                {rows.length} {rows.length === 1 ? "reservation" : "reservations"}{" "}
                on this day
              </p>
            }
          >
            <DataTable className="min-w-[76rem]">
              <THead>
                <TH>Garage</TH>
                <TH>Res. ID</TH>
                <TH>Res. Status</TH>
                <TH>Company</TH>
                <TH>Group</TH>
                <TH>Booking Contact</TH>
                <TH>Pickup Loc.</TH>
                <TH>First Drop-off</TH>
                <TH>Vehicle</TH>
                <TH>Driver</TH>
                <TH>Garage Arrival</TH>
                <TH>Spot</TH>
                <TH>Drop-off</TH>
                <TH>Return</TH>
              </THead>

              <TBody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={14} message="Nothing scheduled for this day" />
                ) : (
                  rows.map((trip) => {
                    const status = pillFor(TRIP_STATUS, trip.status);
                    const vehicles = trip.assignments
                      .map((assignment) => assignment.vehicleName)
                      .filter((name): name is string => Boolean(name));
                    const tripDrivers = trip.assignments
                      .map((assignment) => assignment.driverName)
                      .filter((name): name is string => Boolean(name));

                    return (
                      <TR key={trip.id}>
                        <TD className="max-w-[8rem] truncate">
                          {trip.garageName ?? <Blank />}
                        </TD>
                        <TD>
                          <Link
                            href={`/reservations/${trip.id}`}
                            className="tabular font-medium text-teal-600 hover:underline"
                          >
                            {trip.reference ?? "--"}
                          </Link>
                        </TD>
                        <TD>
                          <StatusPill
                            label={status.label}
                            tone={status.tone}
                            uppercase
                          />
                        </TD>
                        <TD className="max-w-[9rem] truncate">
                          {trip.company ?? <Blank />}
                        </TD>
                        <TD className="max-w-[8rem] truncate">
                          {trip.groupName ?? <Blank />}
                        </TD>
                        <TD className="max-w-[9rem] truncate">
                          {trip.contact ?? <Blank />}
                        </TD>
                        <TD className="max-w-[9rem] truncate">
                          {trip.pickupLocation}
                        </TD>
                        <TD className="max-w-[9rem] truncate">{trip.destination}</TD>
                        <TD>
                          {vehicles.length ? (
                            <span className="text-teal-600">
                              {vehicles.join(", ")}
                            </span>
                          ) : (
                            <span className="text-orange-500">Charter Bus</span>
                          )}
                        </TD>
                        <TD>
                          {tripDrivers.length ? (
                            <span className="text-teal-600">
                              {tripDrivers.join(", ")}
                            </span>
                          ) : (
                            <span className="text-orange-500">1 Driver</span>
                          )}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {trip.garageArrivalAt ? (
                            formatStampTime(trip.garageArrivalAt, zone)
                          ) : (
                            <Blank />
                          )}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {trip.spotAt ? formatStampTime(trip.spotAt, zone) : <Blank />}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {trip.dropoffAt ? (
                            formatStampTime(trip.dropoffAt, zone)
                          ) : (
                            <Blank />
                          )}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {trip.returnAt ? (
                            formatStampTime(trip.returnAt, zone)
                          ) : (
                            <Blank />
                          )}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </DataTable>
          </TableCard>
        </div>

        {gridOn && (
          <aside className="hidden w-[30rem] shrink-0 space-y-3 xl:block">
            <Timeline
              groups={vehicleTimeline.groups}
              bars={vehicleTimeline.bars}
              windowStart={windowStart}
              scale="12h"
              days={1}
              hourWidth={19}
              labelWidth={116}
              timeZone={zone}
            />
            <Timeline
              groups={driverTimeline.groups}
              bars={driverTimeline.bars}
              windowStart={windowStart}
              scale="12h"
              days={1}
              hourWidth={19}
              labelWidth={116}
              timeZone={zone}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function resolveStartDate(value: string | null, timeZone: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = civilDate(new Date(), timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
