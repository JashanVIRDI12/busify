"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ArrowUpRight, BusFront, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { setTripStatusAction } from "@/app/(dashboard)/reservations/actions";
import { TripStatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatStampDate, formatStampTime } from "@/lib/datetime";
import type { DispatchTrip } from "@/lib/queries/dispatch";
import { cn, formatMoney } from "@/lib/utils";
import type { TripStatus } from "@/types/database";

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "SCHEDULED", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** One row of the stop timeline: where, what happens, and when it is planned. */
type TimelineRow = {
  marker: string;
  isGarage: boolean;
  place: string;
  detail?: string | null;
  events: { type: string; at: string | null }[];
};

/**
 * The reservation's planned clock, as the operator entered it on the quote.
 *
 * `trips` stores the four moments a dispatcher actually works to — yard
 * departure, kerb-side spot, the departure itself and the drop — rather than a
 * row per stop. A charter with stops in between is therefore drawn here as its
 * ends: everything the board schedules against is present, and the intermediate
 * stops live on the quote until reservations carry their own stop list.
 */
function buildTimeline(trip: DispatchTrip): TimelineRow[] {
  const rows: TimelineRow[] = [];

  if (trip.garageName || trip.garageArrivalAt) {
    rows.push({
      marker: "G",
      isGarage: true,
      place: trip.garageName ?? "Garage",
      events: [{ type: "Depart", at: trip.garageArrivalAt }],
    });
  }

  rows.push({
    marker: "1",
    isGarage: false,
    place: trip.pickupLocation,
    events: [
      { type: "Pickup", at: trip.spotAt },
      { type: "Depart", at: trip.departureAt },
    ],
  });

  rows.push({
    marker: "2",
    isGarage: false,
    place: trip.destination,
    events: [{ type: "Dropoff", at: trip.dropoffAt }],
  });

  if (trip.returnAt || trip.garageName) {
    rows.push({
      marker: "G",
      isGarage: true,
      place: trip.garageName ?? "Garage",
      events: [{ type: "Return", at: trip.returnAt }],
    });
  }

  return rows;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-ash">{label}</p>
      <p className="mt-0.5 text-body-sm font-medium text-ink">{children}</p>
    </div>
  );
}

/**
 * Everything about one reservation, without leaving the calendar.
 *
 * A dispatcher scanning a month is answering "what is this?" dozens of times an
 * hour. Navigating away and back for each one loses their place in the grid and
 * costs a page load per question, so the answer opens beside the calendar
 * instead. The reference at the top is a real link for the times the answer is
 * "I need to work on this properly".
 */
export function ReservationDrawer({
  trip,
  timeZone,
  currency,
  onClose,
}: {
  trip: DispatchTrip | null;
  timeZone: string;
  currency: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(setTripStatusAction, {
    status: "idle" as const,
  });

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!trip) return null;

  const timeline = buildTimeline(trip);
  const vehicles = trip.assignments.filter((row) => row.vehicleName);
  const drivers = trip.assignments.filter((row) => row.driverName);

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[620px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-bone px-6 py-5">
          <div>
            <SheetTitle className="text-subheading font-semibold text-ink">
              Res. ID:{" "}
              <Link
                href={`/reservations/${trip.id}`}
                className="text-teal-600 hover:underline"
              >
                {trip.reference ?? "—"}
              </Link>
            </SheetTitle>
            <Link
              href={`/reservations/${trip.id}`}
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-teal-600 hover:underline"
            >
              Open full reservation
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <TripStatusBadge status={trip.status as TripStatus} />
        </div>

        {/* Status is the one thing a dispatcher changes from here, so it is the
            one control rather than a form of them. */}
        <div className="grid grid-cols-2 gap-4 border-b border-bone px-6 py-4 sm:grid-cols-4">
          <form action={formAction} className="col-span-2 sm:col-span-1">
            <input type="hidden" name="id" value={trip.id} />
            <label className="text-[11px] text-ash" htmlFor="drawer-status">
              Reservation Status
            </label>
            <Select
              name="status"
              defaultValue={trip.status}
              disabled={pending}
              onValueChange={(value) => {
                const data = new FormData();
                data.set("id", trip.id);
                data.set("status", value);
                formAction(data);
              }}
            >
              <SelectTrigger id="drawer-status" size="sm" className="mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pending && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-ash">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Saving
              </span>
            )}
          </form>

          <Field label="Pickup Date">
            {formatStampDate(trip.departureAt, timeZone)}
          </Field>
          <Field label="Passengers">{trip.passengerCount}</Field>
          <Field label="Balance">
            <span className={cn(trip.balanceDue > 0 && "text-orange-600")}>
              {formatMoney(trip.balanceDue, currency)}
            </span>
          </Field>
        </div>

        <div className="grid gap-3 border-b border-bone px-6 py-4 sm:grid-cols-2">
          <div className="rounded-xl border border-bone p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-body-sm font-semibold text-teal-700">
                {trip.company ?? "No company"}
              </p>
              <span className="shrink-0 rounded-full border border-bone px-2 py-0.5 text-[10px] text-ash">
                Company
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-bone bg-teal-50/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-body-sm font-semibold text-teal-700">
                {trip.contact ?? trip.groupName ?? "No contact"}
              </p>
              <span className="shrink-0 rounded-full border border-bone bg-signal-white px-2 py-0.5 text-[10px] text-ash">
                Booking
              </span>
            </div>
            {trip.groupName && trip.contact && (
              <p className="mt-0.5 truncate text-[12px] text-slate">
                {trip.groupName}
              </p>
            )}
          </div>
        </div>

        {/* Stop timeline */}
        <div className="border-b border-bone px-6 py-4">
          <div className="mb-2 grid grid-cols-[1fr_92px_150px] gap-2 text-[11px] font-semibold tracking-wide text-ash uppercase">
            <span>Stop</span>
            <span>Type</span>
            <span>Planned</span>
          </div>

          <ol className="space-y-3">
            {timeline.map((row, index) => (
              <li
                key={`${row.marker}-${index}`}
                className="grid grid-cols-[1fr_92px_150px] gap-2"
              >
                <div className="flex min-w-0 gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      row.isGarage
                        ? "bg-mercury text-slate"
                        : "bg-teal-500 text-signal-white",
                    )}
                  >
                    {row.marker}
                  </span>
                  <span className="min-w-0 text-body-sm text-ink">
                    {row.place}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {row.events.map((event) => (
                    <p
                      key={event.type}
                      className="text-body-sm font-medium text-teal-600"
                    >
                      {event.type}
                    </p>
                  ))}
                </div>

                <div className="space-y-0.5">
                  {row.events.map((event) => (
                    <p
                      key={event.type}
                      className="tabular text-[12px] text-slate"
                    >
                      {event.at
                        ? `${formatStampDate(event.at, timeZone)} · ${formatStampTime(event.at, timeZone)}`
                        : "--"}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Assignment */}
        <div className="grid gap-5 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-ink">
              Assignment
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-ash">
                <BusFront className="size-3.5" aria-hidden="true" />
                {vehicles.length}/{Math.max(trip.assignments.length, 1)}
                <User className="ml-1 size-3.5" aria-hidden="true" />
                {drivers.length}/{Math.max(trip.assignments.length, 1)}
              </span>
            </p>

            {trip.assignments.length === 0 ? (
              <p className="text-body-sm text-ash">Nothing assigned yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {trip.assignments.map((row) => (
                  <li key={row.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                        <BusFront className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] text-ash">
                          {row.vehicleTypeName ?? "Vehicle"}
                        </span>
                        <span className="block truncate text-body-sm font-medium text-teal-700">
                          {row.vehicleName ?? "Unassigned"}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-semibold text-teal-700">
                        {row.driverName?.slice(0, 1).toUpperCase() ?? "?"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] text-ash">Driver</span>
                        <span className="block truncate text-body-sm font-medium text-teal-700">
                          {row.driverName ?? "Unassigned"}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-body-sm font-semibold text-ink">Notes</p>
            <p className="text-[11px] text-ash">Trip Notes</p>
            <p className="mt-0.5 text-body-sm whitespace-pre-line text-slate">
              {trip.notes?.trim() || "--"}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
