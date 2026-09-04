import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  CalendarClock,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

import { TripStatusControl } from "@/components/driver/trip-status-control";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDriver } from "@/lib/auth/session";
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { getAssignedTrip } from "@/lib/queries/driver";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trip = await getAssignedTrip(id);
  return {
    title: trip ? `${trip.pickup_location} → ${trip.destination}` : "Trip",
  };
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ash" aria-hidden />
      <div className="min-w-0">
        <p className="text-[12px] font-medium tracking-wide uppercase text-ash">
          {label}
        </p>
        <div className="mt-0.5 text-body-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export default async function DriverTripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireDriver();
  const timeZone = organization.timezone;

  const trip = await getAssignedTrip(id);
  if (!trip) notFound();

  const customerName = trip.customer
    ? [trip.customer.first_name, trip.customer.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/driver">
          <ArrowLeft />
          All trips
        </Link>
      </Button>

      <PageHeader
        eyebrow={relativeDays(trip.departure_at)}
        title={`${trip.pickup_location} → ${trip.destination}`}
      />

      <TripStatusControl tripId={trip.id} status={trip.status} />

      <Card>
        <CardContent className="divide-y divide-bone">
          <Row icon={CalendarClock} label="Departs">
            {formatDateTime(trip.departure_at, timeZone)}
          </Row>
          {trip.return_at && (
            <Row icon={CalendarClock} label="Returns">
              {formatDateTime(trip.return_at, timeZone)}
            </Row>
          )}
          <Row icon={Users} label="Passengers">
            {formatNumber(trip.passenger_count)}
          </Row>
          <Row icon={BusFront} label="Vehicle">
            {trip.vehicle ? (
              <>
                {trip.vehicle.name}
                <span className="text-ash">
                  {" · "}
                  {trip.vehicle.registration_number}
                  {trip.vehicle.capacity ? ` · ${trip.vehicle.capacity} seats` : ""}
                </span>
              </>
            ) : (
              <span className="text-ash">Not assigned yet</span>
            )}
          </Row>
          <Row icon={UserRound} label="Your role">
            {trip.myRole === "RELIEF" ? "Relief driver" : "Primary driver"}
          </Row>
          {trip.coDrivers.length > 0 && (
            <Row icon={Users} label="Other drivers">
              {trip.coDrivers
                .map((d) => [d.first_name, d.last_name].filter(Boolean).join(" "))
                .join(", ")}
            </Row>
          )}
          {(customerName || trip.customer?.phone) && (
            <Row icon={Phone} label="Customer">
              {customerName}
              {trip.customer?.phone && (
                <a
                  href={`tel:${trip.customer.phone}`}
                  className="ml-2 font-medium text-interactive hover:underline"
                >
                  {trip.customer.phone}
                </a>
              )}
            </Row>
          )}
          {trip.notes && (
            <Row icon={ArrowRight} label="Notes">
              <span className="whitespace-pre-wrap text-pretty">{trip.notes}</span>
            </Row>
          )}
        </CardContent>
      </Card>

      {trip.passengers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Passenger manifest</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-bone">
            {trip.passengers.map((passenger) => (
              <div
                key={passenger.id}
                className="flex items-center justify-between gap-3 py-2.5 text-body-sm"
              >
                <span className="text-ink">{passenger.full_name}</span>
                <span className="text-ash">
                  {[passenger.seat_label, passenger.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
