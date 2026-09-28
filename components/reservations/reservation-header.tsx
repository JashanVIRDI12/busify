import { CalendarClock, Route, Users } from "lucide-react";

import { EditReservationDialog } from "@/components/reservations/edit-reservation-dialog";
import { TripStatusBadge } from "@/components/shared/status-badge";
import { formatDayLabel, formatStampTime, relativeDays } from "@/lib/datetime";
import { formatNumber } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Trip = Tables<"trips">;

/** "22 Elm St, Toronto, ON M5G 1G7, Canada" → "22 Elm St". */
function street(value: string | null | undefined): string | null {
  return value?.split(",")[0]?.trim() || null;
}

/**
 * Who the job is for and when it goes, in one glance.
 *
 * The job's own name leads — "Nwosu–Adeyemi wedding shuttle" is what the
 * office calls it on the phone — and two full postal addresses are cut to the
 * streets that tell them apart. A job with no name falls back to its route.
 */
export function ReservationHeader({
  trip,
  timeZone,
  canEdit = false,
}: {
  trip: Trip;
  timeZone: string;
  /** Offer the edit dialog; false for read-only roles and closed trips. */
  canEdit?: boolean;
}) {
  const from = street(trip.pickup_location);
  const to = street(trip.destination);
  const route = from && to && from !== to ? `${from} → ${to}` : from ?? to;
  const name = trip.group_name?.trim();
  const passengers = trip.passenger_count;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-heading-sm font-semibold text-balance text-ink">
            {name || route || "Reservation"}
          </h1>
          {trip.reference && (
            <span className="tabular rounded-full border border-cloud bg-signal-white px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap text-slate">
              Reservation {trip.reference}
            </span>
          )}
        </div>

        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-sm text-slate [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ash">
          <li className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" />
            <span className="tabular">
              {formatDayLabel(trip.departure_at, timeZone)} ·{" "}
              {formatStampTime(trip.departure_at, timeZone)} ·{" "}
              {relativeDays(trip.departure_at, timeZone)}
            </span>
          </li>
          {passengers > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" />
              <span className="tabular">
                {formatNumber(passengers)} {passengers === 1 ? "passenger" : "passengers"}
              </span>
            </li>
          )}
          {name && route && (
            <li className="inline-flex min-w-0 items-center gap-1.5">
              <Route aria-hidden="true" />
              <span className="truncate">{route}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <TripStatusBadge status={trip.status} />
        {canEdit && <EditReservationDialog trip={trip} timeZone={timeZone} />}
      </div>
    </header>
  );
}
