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
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { canWrite } from "@/lib/permissions";
import { getFleetAvailability } from "@/lib/queries/availability";
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
      ? `${detail.trip.pickup_location} → ${detail.trip.destination}`
      : "Trip",
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

  // Exclude this trip from the conflict set, or its own coaches would report
  // as busy with themselves.
  const availability = await getFleetAvailability(trip, { excludeTripId: trip.id });

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

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/reservations">
          <ArrowLeft />
          Back to trips
        </Link>
      </Button>

      <PageHeader
        eyebrow="Trip"
        title={`${trip.pickup_location} → ${trip.destination}`}
        description={`Departs ${formatDateTime(trip.departure_at, timeZone)} · ${relativeDays(trip.departure_at)}`}
        actions={<TripStatusBadge status={trip.status} />}
      />

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
                      {relativeDays(trip.departure_at)}
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
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
