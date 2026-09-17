"use client";

import { useState } from "react";

import { WEEKDAYS, type CalendarDay } from "@/lib/calendar";
import type { DispatchTrip } from "@/lib/queries/dispatch";
import { cn } from "@/lib/utils";

import { ReservationDrawer } from "./reservation-drawer";

export type CalendarCell = {
  day: CalendarDay;
  /** Trip ids on this square, in departure order. */
  tripIds: string[];
  /** Ids whose charter started before this square — drawn as continuations. */
  continuing: string[];
};

/**
 * Colour carries assignment state, because that is the only thing a dispatcher
 * scans a month for: what still needs a coach or a driver against it.
 *
 * Teal is crewed and settled, amber is half-crewed, orange is untouched, and a
 * cancelled job goes grey with its text struck through rather than disappearing
 * — a trip that vanished is indistinguishable from one nobody entered.
 */
function chipTone(trip: DispatchTrip): string {
  if (trip.status === "CANCELLED") {
    return "border-l-ash bg-mist text-ash line-through";
  }
  if (trip.status === "COMPLETED") {
    return "border-l-teal-600 bg-teal-50/70 text-slate";
  }
  switch (trip.assignmentStatus) {
    case "ASSIGNED":
      return "border-l-teal-500 bg-teal-50 text-ink";
    case "PARTIAL":
      return "border-l-amber bg-amber/10 text-ink";
    default:
      return "border-l-orange-400 bg-orange-50 text-ink";
  }
}

/** "11425-1 Hassan, Hassan Coach" — the line a dispatcher actually reads. */
function chipLabel(trip: DispatchTrip): string {
  const who = [trip.contact, trip.company].filter(Boolean).join(", ");
  return [trip.reference, who || trip.pickupLocation]
    .filter(Boolean)
    .join(" ");
}

/**
 * The month grid.
 *
 * A client component because a chip opens a panel rather than a page: the
 * dispatcher stays on the square they were reading. Every trip on a day is
 * drawn, with no "+3 more" — a hidden reservation on a dispatch board is a
 * reservation nobody crews.
 */
export function CalendarBoard({
  cells,
  trips,
  timeZone,
  currency,
}: {
  cells: CalendarCell[];
  trips: DispatchTrip[];
  timeZone: string;
  currency: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = new Map(trips.map((trip) => [trip.id, trip]));

  return (
    <>
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
          {cells.map(({ day, tripIds, continuing }) => {
            const carried = new Set(continuing);
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

                <ul className="space-y-1">
                  {tripIds.map((id) => {
                    const trip = byId.get(id);
                    if (!trip) return null;

                    return (
                      <li key={`${day.key}-${id}`}>
                        <button
                          type="button"
                          onClick={() => setOpenId(id)}
                          title={chipLabel(trip)}
                          className={cn(
                            "block w-full truncate rounded-sm border-l-[3px] px-1.5 py-[3px] text-left text-[11.5px] leading-tight",
                            "transition-colors hover:brightness-95",
                            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500",
                            chipTone(trip),
                          )}
                        >
                          {/* A charter that began earlier is marked, so a
                              dispatcher does not read day three as a new job. */}
                          {carried.has(id) && (
                            <span aria-hidden="true" className="text-ash">
                              …
                            </span>
                          )}
                          <span className="sr-only">
                            {carried.has(id) ? "Continues from an earlier day: " : ""}
                          </span>
                          {chipLabel(trip)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <ReservationDrawer
        trip={openId ? (byId.get(openId) ?? null) : null}
        timeZone={timeZone}
        currency={currency}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
