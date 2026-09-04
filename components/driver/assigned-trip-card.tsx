import Link from "next/link";
import { ArrowRight, BusFront, MapPin, Users } from "lucide-react";

import { TripStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { formatNumber } from "@/lib/utils";
import type { DriverTrip } from "@/lib/queries/driver";

export function AssignedTripCard({
  trip,
  timeZone,
}: {
  trip: DriverTrip;
  timeZone: string;
}) {
  return (
    <Link
      href={`/driver/trips/${trip.id}`}
      className="block rounded-2xl border border-bone bg-signal-white p-5 transition-colors hover:border-cloud focus-visible:border-ink focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-body font-semibold text-ink">
            <span className="truncate">{trip.pickup_location}</span>
            <ArrowRight className="size-4 shrink-0 text-cloud" aria-hidden />
            <span className="truncate">{trip.destination}</span>
          </p>
          <p className="mt-1 text-body-sm text-slate">
            {formatDateTime(trip.departure_at, timeZone)}
            <span className="mx-1.5 text-cloud">·</span>
            {relativeDays(trip.departure_at)}
          </p>
        </div>
        <TripStatusBadge status={trip.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-body-sm text-slate">
        <span className="flex items-center gap-1.5">
          <Users className="size-4 shrink-0 text-ash" aria-hidden />
          {formatNumber(trip.passenger_count)} passengers
        </span>
        {trip.vehicle && (
          <span className="flex items-center gap-1.5">
            <BusFront className="size-4 shrink-0 text-ash" aria-hidden />
            {trip.vehicle.name}
          </span>
        )}
        {trip.myRole === "RELIEF" && (
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <MapPin className="size-4 shrink-0 text-ash" aria-hidden />
            Relief driver
          </span>
        )}
      </div>
    </Link>
  );
}
