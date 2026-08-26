import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Route, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { RowLink } from "@/components/shared/row-link";
import { SearchInput } from "@/components/shared/search-input";
import {
  TRIP_STATUS_LABELS,
  TripStatusBadge,
} from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { getTripIdsMissingDriver } from "@/lib/queries/trips";
import { formatNumber } from "@/lib/utils";
import type { TripStatus } from "@/types/database";

export const metadata: Metadata = { title: "Trips" };

const TRIP_STATUSES: TripStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; missing?: string }>;
}) {
  const { organization } = await requireSession();
  const { q, status, missing } = await searchParams;
  const activeStatus = TRIP_STATUSES.includes(status as TripStatus)
    ? (status as TripStatus)
    : null;
  const onlyMissingDriver = missing === "driver";

  const supabase = await createClient();

  const [{ data: statusRows }, missingDriverIds] = await Promise.all([
    supabase.from("trips").select("status"),
    getTripIdsMissingDriver(),
  ]);

  let query = supabase
    .from("trips")
    .select("*")
    .order("departure_at", { ascending: true })
    .limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);
  if (onlyMissingDriver) {
    // An empty IN () is invalid, so short-circuit on a value that matches nothing.
    query = query.in(
      "id",
      missingDriverIds.length > 0
        ? missingDriverIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`pickup_location.ilike.${term},destination.ilike.${term}`);
  }

  const { data, error } = await query;
  const trips = data ?? [];

  // Resolve assignments for the visible page only.
  const tripIds = trips.map((trip) => trip.id);
  const [{ data: assignments }, { data: vehicles }, { data: drivers }] =
    await Promise.all([
      tripIds.length
        ? supabase
            .from("trip_assignments")
            .select("trip_id, vehicle_id, driver_id")
            .in("trip_id", tripIds)
        : Promise.resolve({ data: [] }),
      supabase.from("vehicles").select("id, name"),
      supabase.from("drivers").select("id, first_name, last_name"),
    ]);

  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, v.name]));
  const driverName = new Map(
    (drivers ?? []).map((d) => [
      d.id,
      [d.first_name, d.last_name].filter(Boolean).join(" "),
    ]),
  );

  const crewByTrip = new Map<string, { vehicles: string[]; drivers: string[] }>();
  for (const row of assignments ?? []) {
    const entry = crewByTrip.get(row.trip_id) ?? { vehicles: [], drivers: [] };
    if (row.vehicle_id) {
      const name = vehicleName.get(row.vehicle_id);
      if (name) entry.vehicles.push(name);
    }
    if (row.driver_id) {
      const name = driverName.get(row.driver_id);
      if (name) entry.drivers.push(name);
    }
    crewByTrip.set(row.trip_id, entry);
  }

  const counts = new Map<TripStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...TRIP_STATUSES.map((value) => ({
      label: TRIP_STATUS_LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  const timeZone = organization.timezone;
  const filtered = Boolean(q || activeStatus || onlyMissingDriver);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips"
        description="Work you have committed to. Trips appear here when you accept a request."
        actions={
          missingDriverIds.length > 0 ? (
            <Button variant={onlyMissingDriver ? "default" : "outline"} asChild>
              <Link href={onlyMissingDriver ? "/trips" : "/trips?missing=driver"}>
                <TriangleAlert />
                {onlyMissingDriver
                  ? "Show all trips"
                  : `${missingDriverIds.length} without a driver`}
              </Link>
            </Button>
          ) : null
        }
      />

      <ListShell
        toolbar={
          <>
            <FilterTabs tabs={tabs} />
            <SearchInput placeholder="Search pickup or destination…" />
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={Route}
            title="We could not load your trips"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Route}
            title={filtered ? "No trips match those filters" : "No trips yet"}
            description={
              filtered
                ? "Clear the search or pick a different status."
                : "Accept a trip request and it will be scheduled here."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-right">Pax</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => {
                const crew = crewByTrip.get(trip.id);
                const hasDriver = Boolean(crew?.drivers.length);
                const hasVehicle = Boolean(crew?.vehicles.length);

                return (
                  <TableRow key={trip.id} className="relative cursor-pointer">
                    <TableCell>
                      <RowLink
                        href={`/trips/${trip.id}`}
                        className="flex items-center gap-1.5 text-body-sm font-semibold text-ink"
                      >
                        {trip.pickup_location}
                        <ArrowRight
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        {trip.destination}
                      </RowLink>
                      {trip.return_at && (
                        <span className="tabular block text-xs text-muted-foreground">
                          Returns {formatDateTime(trip.return_at, timeZone)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="tabular block text-sm">
                        {formatDateTime(trip.departure_at, timeZone)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {relativeDays(trip.departure_at)}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatNumber(trip.passenger_count)}
                    </TableCell>
                    <TableCell>
                      {hasVehicle || hasDriver ? (
                        <span className="block text-sm">
                          {crew?.vehicles.join(", ") || "No vehicle"}
                          <span className="block text-xs text-muted-foreground">
                            {crew?.drivers.join(", ") || "No driver"}
                          </span>
                        </span>
                      ) : (
                        <Badge variant="warning">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TripStatusBadge status={trip.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListShell>
    </div>
  );
}
