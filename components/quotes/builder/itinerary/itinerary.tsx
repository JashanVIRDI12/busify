"use client";

import { useEffect } from "react";
import { Reorder } from "framer-motion";
import { Loader2, Plus, Route } from "lucide-react";

import type { QuoteStopInput, QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";
import { GarageRow } from "./garage-row";
import { StopRow } from "./stop-row";
import { useAutoRoute } from "./use-auto-route";
import type { AutoSchedule } from "./use-auto-schedule";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The trip's route: yard, stops, yard.
 *
 * Owns the roll-up of distance and time from the per-leg figures the router
 * writes, so that exactly one place decides what "total" means and the rows
 * below only ever report their own leg.
 */
export function Itinerary({
  trip,
  schedule,
}: {
  trip: QuoteTripInput;
  schedule: AutoSchedule;
}) {
  const { reorderStops, addStop, setTrip, canEdit } = useBuilder();
  const routing = useAutoRoute(trip);

  // Recompute the trip's distance/time totals from the legs.
  useEffect(() => {
    const stopLegMiles = trip.stops.reduce((sum, s) => sum + (s.leg_miles || 0), 0);
    const stopLegMinutes = trip.stops.reduce(
      (sum, s) => sum + (s.leg_minutes || 0),
      0,
    );
    const total = stopLegMiles + trip.return_leg_miles;
    const minutes = stopLegMinutes + trip.return_leg_minutes;

    // Miles before the first stop and after the last are "dead" (no passengers).
    const firstLeg = trip.stops[0]?.leg_miles ?? 0;
    const dead = firstLeg + trip.return_leg_miles;
    const live = Math.max(total - dead, 0);

    if (
      round2(total) !== round2(trip.total_miles) ||
      round2(dead) !== round2(trip.dead_miles) ||
      round2(live) !== round2(trip.live_miles) ||
      Math.round(minutes) !== trip.estimated_minutes
    ) {
      setTrip(trip.id, {
        total_miles: round2(total),
        dead_miles: round2(dead),
        live_miles: round2(live),
        estimated_minutes: Math.round(minutes),
      });
    }
  }, [
    trip.id,
    trip.stops,
    trip.return_leg_miles,
    trip.return_leg_minutes,
    trip.total_miles,
    trip.dead_miles,
    trip.live_miles,
    trip.estimated_minutes,
    setTrip,
  ]);

  /**
   * What a stop is called, which is decided by where it sits rather than by
   * anything typed. Lives here because the leg summary on one row has to name
   * the row above it, and only this component can see both.
   */
  const nameOf = (index: number) =>
    index === 0
      ? "Pickup"
      : index === trip.stops.length - 1
        ? "Dropoff"
        : `Stop ${index + 1}`;

  const cumulative = trip.stops.reduce<{ miles: number; minutes: number }[]>(
    (acc, stop) => {
      const previous = acc[acc.length - 1] ?? { miles: 0, minutes: 0 };
      acc.push({
        miles: previous.miles + (stop.leg_miles || 0),
        minutes: previous.minutes + (stop.leg_minutes || 0),
      });
      return acc;
    },
    [],
  );

  return (
    <div className="space-y-3">
      <GarageRow trip={trip} which="departing" schedule={schedule} />

      <Reorder.Group
        axis="y"
        values={trip.stops}
        onReorder={(next) => reorderStops(trip.id, next as QuoteStopInput[])}
        className="space-y-3"
      >
        {trip.stops.map((stop, index) => (
          <StopRow
            key={stop.id}
            trip={trip}
            stop={stop}
            index={index}
            previousLabel={nameOf(index - 1)}
            isFirst={index === 0}
            isLast={index === trip.stops.length - 1}
            legMinutes={stop.leg_minutes || 0}
            legMiles={stop.leg_miles || 0}
            cumulativeMiles={cumulative[index]?.miles ?? 0}
            cumulativeMinutes={cumulative[index]?.minutes ?? 0}
            measuring={routing === "measuring"}
            schedule={schedule}
          />
        ))}
      </Reorder.Group>

      {canEdit && (
        <div className="relative flex items-center justify-center py-1">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-px bg-bone"
          />
          <button
            type="button"
            onClick={() => addStop(trip.id)}
            className="relative inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-signal-white px-4 py-2 text-body-sm font-semibold text-orange-600 transition-colors hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <Plus className="size-4" aria-hidden="true" /> Add Stop
          </button>
        </div>
      )}

      {/*
        Status for work nobody asked for, so it stays quiet: a line of small
        text that appears while measuring and says what to do if it fails,
        rather than a spinner that blocks a form the operator can still fill in.
      */}
      {canEdit && routing !== "idle" && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-1.5 text-[12px] text-ash"
        >
          {routing === "measuring" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Measuring distance and drive time…
            </>
          ) : (
            <>
              <Route className="size-3.5" aria-hidden="true" />
              Could not measure this route — enter the distances by hand.
            </>
          )}
        </p>
      )}

      <GarageRow trip={trip} which="returning" schedule={schedule} />
    </div>
  );
}
