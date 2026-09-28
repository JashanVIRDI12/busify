"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowUpRight, BusFront, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import {
  assignToTripAction,
  assignmentOptionsAction,
  setAssignmentPartAction,
  setTripStatusAction,
  type AssignmentOption,
} from "@/app/(dashboard)/reservations/actions";
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
import type { DispatchAssignment, DispatchTrip } from "@/lib/queries/dispatch";
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

const NONE = "__none__";

type CrewOptions = { vehicles: AssignmentOption[]; drivers: AssignmentOption[] } | null;

/**
 * A coach or a driver, pickable where it is read.
 *
 * Reads as the name it already shows until reached for, like the quote rail's
 * inline selects. An empty slot is orange, the product's colour for a gap to
 * fill, so a job with a coach and no driver is visibly unfinished on the board.
 */
function CrewPicker({
  kind,
  tripId,
  row,
  options,
  canEdit,
}: {
  kind: "vehicle" | "driver";
  tripId: string;
  /** Null when the trip has no assignment row yet. */
  row: DispatchAssignment | null;
  options: CrewOptions;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currentId = (kind === "vehicle" ? row?.vehicleId : row?.driverId) ?? null;
  const currentName = (kind === "vehicle" ? row?.vehicleName : row?.driverName) ?? null;
  const free = options ? (kind === "vehicle" ? options.vehicles : options.drivers) : null;
  const noun = kind === "vehicle" ? "vehicles" : "drivers";

  const text = (
    <span
      className={cn(
        "block truncate text-body-sm font-medium",
        currentName ? "text-teal-700" : "text-orange-600",
      )}
    >
      {currentName ?? "Unassigned"}
    </span>
  );

  if (!canEdit) return text;

  function choose(value: string) {
    const next = value === NONE ? null : value;
    if (next === currentId) return;

    startTransition(async () => {
      let message: string | null = null;
      if (row) {
        const result = await setAssignmentPartAction({
          assignment_id: row.id,
          field: kind === "vehicle" ? "vehicle_id" : "driver_id",
          value: next,
        });
        if (!result.ok) message = result.message;
      } else if (next) {
        // Nothing on the trip yet: the ordinary assign, which creates the row.
        const data = new FormData();
        data.set("trip_id", tripId);
        data.set(kind === "vehicle" ? "vehicle_id" : "driver_id", next);
        const result = await assignToTripAction({ status: "idle" }, data);
        if (result.status === "error") message = result.message ?? "Could not assign.";
      }

      if (message) {
        toast.error(message);
        return;
      }
      const name =
        next === null ? null : (free?.find((option) => option.id === next)?.label ?? "");
      toast.success(
        next === null
          ? `${kind === "vehicle" ? "Vehicle" : "Driver"} removed.`
          : `${name} assigned.`,
      );
      router.refresh();
    });
  }

  return (
    <Select value={currentId ?? NONE} onValueChange={choose} disabled={pending}>
      <SelectTrigger
        size="sm"
        aria-label={kind === "vehicle" ? "Vehicle" : "Driver"}
        className={cn(
          "-ml-1 h-7 w-auto max-w-full gap-1 border-none px-1 text-left text-body-sm font-medium whitespace-nowrap shadow-none hover:bg-mist [&>span]:truncate",
          currentName ? "text-teal-700" : "text-orange-600",
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Saving
          </span>
        ) : (
          <SelectValue>{currentName ?? "Unassigned"}</SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unassigned</SelectItem>
        {currentId && currentName && (
          <SelectItem value={currentId}>{currentName}</SelectItem>
        )}
        {free === null ? (
          <SelectItem value="__loading__" disabled>
            Checking who is free…
          </SelectItem>
        ) : free.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            No {noun} free on these dates
          </SelectItem>
        ) : (
          free.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
              {option.detail && (
                <span className="ml-2 text-[12px] text-ash">{option.detail}</span>
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
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
  canEdit = false,
  onClose,
}: {
  trip: DispatchTrip | null;
  timeZone: string;
  currency: string;
  /** Whether the viewer may change status and crew from here. */
  canEdit?: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(setTripStatusAction, {
    status: "idle" as const,
  });
  const locked = trip?.status === "COMPLETED" || trip?.status === "CANCELLED";
  const crewEditable = canEdit && !locked;

  // Who is free for this trip, fetched when it opens and again whenever its
  // crew changes, since a driver just put on it is no longer free.
  const crewKey = trip
    ? `${trip.id}:${trip.assignments.map((row) => `${row.vehicleId}/${row.driverId}`).join(",")}`
    : null;
  const [crewOptions, setCrewOptions] = useState<{ key: string; options: CrewOptions } | null>(
    null,
  );
  useEffect(() => {
    if (!crewKey || !crewEditable || !trip) return;
    let live = true;
    assignmentOptionsAction(trip.id).then((result) => {
      if (live && result.ok) setCrewOptions({ key: crewKey, options: result.data });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewKey, crewEditable]);
  const options = crewOptions?.key === crewKey ? crewOptions.options : null;

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

            {trip.assignments.length === 0 && !crewEditable ? (
              <p className="text-body-sm text-ash">Nothing assigned yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {(trip.assignments.length > 0 ? trip.assignments : [null]).map((row, index) => (
                  <li key={row?.id ?? `new-${index}`} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                        <BusFront className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-ash">
                          {row?.vehicleTypeName ?? "Vehicle"}
                        </span>
                        <CrewPicker
                          kind="vehicle"
                          tripId={trip.id}
                          row={row}
                          options={options}
                          canEdit={crewEditable}
                        />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          row?.driverName
                            ? "bg-teal-100 text-teal-700"
                            : "bg-orange-50 text-orange-600",
                        )}
                      >
                        {row?.driverName?.slice(0, 1).toUpperCase() ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-ash">Driver</span>
                        <CrewPicker
                          kind="driver"
                          tripId={trip.id}
                          row={row}
                          options={options}
                          canEdit={crewEditable}
                        />
                        {row?.driverPhone && (
                          <a
                            href={`tel:${row.driverPhone.replace(/[^\d+]/g, "")}`}
                            className="tabular block w-fit text-[12px] text-slate hover:text-teal-600 hover:underline"
                          >
                            {row.driverPhone}
                          </a>
                        )}
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
