"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripHorizontal, Trash2 } from "lucide-react";

import { AddressField } from "@/components/quotes/builder/address-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { QuoteStopInput, QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";
import { NumericInput } from "../numeric-input";
import {
  DateField,
  DisclosureButton,
  LegPill,
  LockedField,
  RevertButton,
  TimeField,
} from "./field-parts";
import { autoKey, type AutoSchedule } from "./use-auto-schedule";

/**
 * One stop on the itinerary.
 *
 * The row asks four things — where, what to call it, which day, what time —
 * and folds everything else away. Spot times, waiting time and notes matter on
 * perhaps one trip in five, and a field that is visible is a field an operator
 * has to decide about, even when the decision is "not this time".
 *
 * The pickup and dropoff are tinted and cannot be deleted: every charter has
 * them, and a stop list that can be emptied to nothing is not an itinerary.
 */
export function StopRow({
  trip,
  stop,
  index,
  previousLabel,
  isFirst,
  isLast,
  legMinutes,
  legMiles,
  cumulativeMiles,
  cumulativeMinutes,
  measuring,
  schedule,
}: {
  trip: QuoteTripInput;
  stop: QuoteStopInput;
  index: number;
  /** What the stop before this one is called, for the leg summary. */
  previousLabel: string;
  isFirst: boolean;
  isLast: boolean;
  legMinutes: number;
  legMiles: number;
  cumulativeMiles: number;
  cumulativeMinutes: number;
  measuring: boolean;
  schedule: AutoSchedule;
}) {
  const { setStop, removeStop, canEdit } = useBuilder();
  const controls = useDragControls();

  const [showSpot, setShowSpot] = useState(Boolean(stop.spot_time));
  const [showDwell, setShowDwell] = useState(Boolean(stop.dwell_minutes));
  const [showNotes, setShowNotes] = useState(Boolean(stop.notes));

  // Position decides the role, so the first and last rows are named for what
  // they are rather than numbered. Only the stops in between need a number,
  // because only they have nothing else to be called.
  const role = isFirst ? "Pickup" : isLast ? "Dropoff" : null;
  const heading = role ?? `Stop ${index + 1}`;
  const timeLabel = isFirst ? "Depart Time" : isLast ? "Arrive Time" : "Time";

  const arriveKey = autoKey.arrive(stop.id);
  const timeIsAuto = !isFirst && schedule.isAuto(arriveKey, stop.stop_time);
  const spotIsAuto = schedule.isAuto(autoKey.spot(stop.id), stop.spot_time);
  const canRevertTime = canEdit && !isFirst && !timeIsAuto && Boolean(stop.stop_time);

  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "rounded-xl border p-4 transition-colors",
        role
          ? "border-teal-100 bg-teal-50/60"
          : "border-bone bg-signal-white hover:border-cloud",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <h4 className="text-body-sm font-semibold text-ink">{heading}</h4>

        <div className="flex flex-1 justify-center">
          {canEdit && (
            <button
              type="button"
              onPointerDown={(event) => controls.start(event)}
              className="cursor-grab touch-none rounded-md p-1 text-cloud transition-colors hover:text-ash active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500"
              aria-label={`Drag to reorder stop ${index + 1}`}
            >
              <GripHorizontal className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {canEdit && !isFirst && !isLast ? (
          <button
            type="button"
            onClick={() => removeStop(trip.id, stop.id)}
            className="rounded-md p-1.5 text-ash transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500"
            aria-label={`Remove stop ${index + 1}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ) : (
          // Holds the column so every row's grip lands on the same centre line.
          <span className="size-7" aria-hidden="true" />
        )}
      </div>

      {/*
        The drive that produced this arrival, sat directly above the date and time
        it explains. Width matches the two columns beneath it on wide screens.
      */}
      {!isFirst && (
        <div className="mb-2 xl:ml-auto xl:w-[357px]">
          <LegPill
            fromLabel={previousLabel}
            toLabel={heading}
            minutes={legMinutes}
            miles={legMiles}
            totalMinutes={cumulativeMinutes}
            totalMiles={cumulativeMiles}
            measuring={measuring}
          />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_165px_180px]">
        <AddressField
          value={stop.address ?? ""}
          disabled={!canEdit}
          onChange={(address, point) =>
            setStop(trip.id, stop.id, {
              address: address || null,
              latitude: point?.lat ?? null,
              longitude: point?.lng ?? null,
            })
          }
        />

        {role ? (
          <LockedField value={role} />
        ) : (
          <Input
            aria-label={`Name for stop ${index + 1}`}
            placeholder="Name this stop, e.g. Lunch"
            value={stop.label ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setStop(trip.id, stop.id, { label: e.target.value || null })
            }
          />
        )}

        <DateField
          value={stop.stop_date}
          disabled={!canEdit}
          auto={timeIsAuto}
          onChange={(value) => setStop(trip.id, stop.id, { stop_date: value })}
        />

        <div className="flex items-center gap-1">
          <TimeField
            className="flex-1"
            label={timeLabel}
            value={stop.stop_time}
            disabled={!canEdit}
            auto={timeIsAuto}
            onChange={(value) => setStop(trip.id, stop.id, { stop_time: value })}
          />
          {canRevertTime && (
            <RevertButton
              label="Go back to the calculated arrival"
              onClick={() => setStop(trip.id, stop.id, { stop_time: null })}
            />
          )}
        </div>
      </div>

      {/* Everything optional, folded until asked for. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
        {isFirst && (showSpot || stop.spot_time) ? (
          <TimeField
            className="w-44"
            label="Spot Time"
            value={stop.spot_time}
            disabled={!canEdit}
            auto={spotIsAuto}
            onChange={(value) => setStop(trip.id, stop.id, { spot_time: value })}
          />
        ) : (
          isFirst &&
          canEdit && (
            <DisclosureButton
              label="Add Spot Time"
              onClick={() => setShowSpot(true)}
            />
          )
        )}

        {!isLast && (showDwell || stop.dwell_minutes) ? (
          <label className="flex items-center gap-2 text-[12px] font-medium text-ash">
            Waits here
            <NumericInput
              className="h-9 w-20"
              suffix="min"
              value={stop.dwell_minutes}
              onValueChange={(value) =>
                setStop(trip.id, stop.id, {
                  dwell_minutes: Math.round(value ?? 0),
                })
              }
            />
          </label>
        ) : (
          !isLast &&
          canEdit && (
            <DisclosureButton
              label="Add Wait Time"
              onClick={() => setShowDwell(true)}
            />
          )
        )}

        {canEdit && !showNotes && !stop.notes && (
          <DisclosureButton label="Add Notes" onClick={() => setShowNotes(true)} />
        )}
      </div>

      {(showNotes || stop.notes) && (
        <Input
          aria-label={`Notes for stop ${index + 1}`}
          placeholder="Notes for this stop — gate, dock, who to ask for"
          className="mt-3"
          value={stop.notes ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setStop(trip.id, stop.id, { notes: e.target.value || null })
          }
        />
      )}
    </Reorder.Item>
  );
}
