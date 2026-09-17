import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Inbox,
  Mail,
  Phone,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { TripStatusBadge } from "@/components/shared/status-badge";
import { AssignmentPanel } from "@/components/trips/assignment-panel";
import { ReservationSummary } from "@/components/reservations/reservation-summary";
import { ReservationTabs } from "@/components/reservations/reservation-tabs";
import {
  DriverPayPanel,
  NotificationsPanel,
  PaymentsPanel,
  TicketsPanel,
} from "@/components/reservations/tab-panels";
import { TrackingPanel } from "@/components/reservations/tracking-panel";
import { TripStatusActions } from "@/components/trips/trip-status-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { dayKey } from "@/lib/calendar";
import { civilDate } from "@/lib/date-filters";
import { daysBetweenDates, formatDateTime, relativeDays } from "@/lib/datetime";
import { canWrite, canWriteFinance } from "@/lib/permissions";
import { getFleetAvailability } from "@/lib/queries/availability";
import { getReservationTabData } from "@/lib/queries/reservation-tabs";
import { getTrip } from "@/lib/queries/trips";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getTrip(id);
  return {
    title: detail
      ? `${detail.trip.reference ?? detail.trip.pickup_location} · ${detail.trip.destination}`
      : "Reservation",
  };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role, organization } = await requireSession();

  const detail = await getTrip(id);
  if (!detail) notFound();

  const { trip, customer, request, assignments, seatsAssigned, hasDriver } = detail;
  const timeZone = organization.timezone;

  // Both reads at once. Sequentially they would cost the sum of two round trips
  // to a database that is a long way away; in parallel they cost the slower one.
  const [availability, tabs] = await Promise.all([
    // Exclude this trip from the conflict set, or its own coaches would report
    // as busy with themselves.
    getFleetAvailability(trip, { excludeTripId: trip.id }),
    getReservationTabData(trip.id, trip.quote_id),
  ]);

  const assignedVehicleIds = new Set(
    assignments.map((entry) => entry.vehicle?.id).filter(Boolean),
  );
  const assignedDriverIds = new Set(
    assignments.map((entry) => entry.driver?.id).filter(Boolean),
  );

  const availableVehicles = availability.vehicles
    .filter((entry) => entry.available && !assignedVehicleIds.has(entry.vehicle.id))
    .map((entry) => ({
      id: entry.vehicle.id,
      label: entry.vehicle.name,
      detail: `${entry.vehicle.capacity} seats`,
    }));

  const availableDrivers = availability.drivers
    .filter((entry) => entry.available && !assignedDriverIds.has(entry.driver.id))
    .map((entry) => ({
      id: entry.driver.id,
      label: [entry.driver.first_name, entry.driver.last_name]
        .filter(Boolean)
        .join(" "),
      detail: entry.driver.phone ?? "",
    }));

  const writeAllowed = canWrite(role);
  const locked = trip.status === "COMPLETED" || trip.status === "CANCELLED";

  // Calendar days the job spans, which is what a daily rate bills. Same-day
  // work is one day, not zero, and the boundary is midnight where the operator
  // is rather than wherever the server happens to be.
  const localDay = (iso: string) => {
    const [year, month, day] = civilDate(new Date(iso), timeZone);
    return dayKey(year, month, day);
  };

  const plannedDays =
    Math.max(
      0,
      daysBetweenDates(
        localDay(trip.departure_at),
        localDay(trip.return_at ?? trip.dropoff_at ?? trip.departure_at),
      ) ?? 0,
    ) + 1;

  /**
   * Every placed stop, in order, so the map draws the route the coach drives
   * rather than a straight hop between its ends.
   *
   * Falls back to the two denormalised columns on the reservation for jobs
   * entered straight onto the board, which have no stop rows. A stop whose
   * address was typed rather than picked has no coordinates and is skipped —
   * the line then runs between the ones that do, which is honest about what is
   * known rather than dropping a pin in the Atlantic at 0°N 0°E.
   */
  const stopPoints = tabs.stops
    .map((stop) => ({
      lat: Number(stop.latitude),
      lng: Number(stop.longitude),
      label: stop.label ?? stop.address ?? undefined,
    }))
    .filter((point) => Number.isFinite(point.lat) && point.lat !== 0);

  const mapPoints =
    stopPoints.length > 0
      ? stopPoints
      : [
          {
            lat: Number(trip.pickup_lat),
            lng: Number(trip.pickup_lng),
            label: trip.pickup_location,
          },
          {
            lat: Number(trip.destination_lat),
            lng: Number(trip.destination_lng),
            label: trip.destination,
          },
        ].filter((point) => Number.isFinite(point.lat) && point.lat !== 0);

  const tripPanel = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>The journey</CardTitle>
              <CardDescription>
                All times in {timeZone.replace(/_/g, " ")}.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <ArrowRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Route
                  </p>
                  <p className="text-sm font-medium">
                    {trip.pickup_location} → {trip.destination}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Passengers
                  </p>
                  <p className="tabular text-sm font-medium">
                    {formatNumber(trip.passenger_count)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CalendarClock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Departure
                  </p>
                  <p className="tabular text-sm font-medium">
                    {formatDateTime(trip.departure_at, timeZone)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {relativeDays(trip.departure_at, timeZone)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CalendarClock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Return
                  </p>
                  <p className="tabular text-sm font-medium">
                    {trip.return_at
                      ? formatDateTime(trip.return_at, timeZone)
                      : "One way"}
                  </p>
                </div>
              </div>
            </div>

            {trip.notes && (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {trip.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <AssignmentPanel
          tripId={trip.id}
          assignments={assignments}
          seatsAssigned={seatsAssigned}
          passengerCount={trip.passenger_count}
          hasDriver={hasDriver}
          availableVehicles={availableVehicles}
          availableDrivers={availableDrivers}
          canEdit={writeAllowed}
          locked={locked}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customer</CardTitle>
              {!customer && (
                <CardDescription>
                  Not linked to a customer record.
                </CardDescription>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer ? (
              <>
                <p className="text-sm font-medium">
                  {[customer.first_name, customer.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </p>
                {customer.company && (
                  <p className="text-sm text-muted-foreground">
                    {customer.company}
                  </p>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-2 text-sm text-interactive hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                    {customer.email}
                  </a>
                )}
                {customer.phone && (
                  <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    {customer.phone}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This trip came from a request without a linked customer.
              </p>
            )}

            {request && (
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href={`/trip-requests/${request.id}`}>
                  <Inbox />
                  Request {request.reference ?? ""}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Dispatch</CardTitle>
              <CardDescription>
                Move the trip through its lifecycle.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TripStatusActions
              tripId={trip.id}
              status={trip.status}
              canEdit={writeAllowed}
              hasVehicle={assignments.some((entry) => entry.vehicle !== null)}
              hasDriver={hasDriver}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/reservations">
          <ArrowLeft />
          Back to reservations
        </Link>
      </Button>

      <PageHeader
        eyebrow="Reservation"
        title={`${trip.pickup_location} → ${trip.destination}`}
        description={`Departs ${formatDateTime(trip.departure_at, timeZone)} · ${relativeDays(trip.departure_at, timeZone)}`}
        actions={<TripStatusBadge status={trip.status} />}
      />

      <ReservationSummary
        trip={trip}
        currency={organization.currency}
        timeZone={timeZone}
        canInvoice={canWriteFinance(role)}
      />

      <ReservationTabs
        panels={[
          {
            value: "tracking",
            label: "Tracking",
            content: (
              <TrackingPanel
                points={mapPoints}
                stops={tabs.stops}
                timeZone={timeZone}
                canEdit={writeAllowed}
                plannedMiles={Number(trip.planned_miles ?? 0)}
                plannedMinutes={Number(trip.planned_minutes ?? 0)}
                plannedDays={plannedDays}
              />
            ),
          },
          { value: "trip", label: "Trip", content: tripPanel },
          {
            value: "payments",
            label: "Payments",
            content: (
              <PaymentsPanel
                trip={trip}
                items={tabs.items}
                currency={organization.currency}
              />
            ),
          },
          {
            value: "driver-pay",
            label: "Driver Pay",
            content: (
              <DriverPayPanel
                entries={tabs.driverPay}
                currency={organization.currency}
              />
            ),
          },
          {
            value: "tickets",
            label: "Tickets",
            badge: tabs.tickets.filter((ticket) => ticket.status !== "CLOSED")
              .length,
            content: (
              <TicketsPanel tickets={tabs.tickets} timeZone={timeZone} />
            ),
          },
          {
            value: "notifications",
            label: "Notifications",
            content: <NotificationsPanel />,
          },
        ]}
      />
    </div>
  );
}
