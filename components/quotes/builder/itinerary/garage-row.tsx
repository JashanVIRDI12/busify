"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";
import { NumericInput } from "../numeric-input";
import {
  DateField,
  DisclosureButton,
  LockedField,
  RevertButton,
  TimeField,
} from "./field-parts";
import { autoKey, type AutoSchedule } from "./use-auto-schedule";

const NONE = "__none__";

/**
 * The yard at either end of the trip.
 *
 * Kept visually quieter than the stops — a grey card rather than a tinted one —
 * because the garage is the operator's own business, while the stops are the
 * customer's. The eye should land on the itinerary first.
 */
export function GarageRow({
  trip,
  which,
  schedule,
}: {
  trip: QuoteTripInput;
  which: "departing" | "returning";
  schedule: AutoSchedule;
}) {
  const { setTrip, lookups, canEdit } = useBuilder();
  const isDeparting = which === "departing";

  const garageId = isDeparting
    ? trip.departing_garage_id
    : trip.returning_garage_id;
  const note = isDeparting ? trip.departing_note : trip.returning_note;
  const dateValue = isDeparting ? trip.departing_date : trip.returning_date;
  const timeValue = isDeparting ? trip.departing_time : trip.returning_time;

  const [showArrival, setShowArrival] = useState(
    Boolean(trip.departing_arrival_time),
  );
  const [showDistance, setShowDistance] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(note));

  const timeKey = isDeparting ? autoKey.departingTime : autoKey.returningTime;
  const timeIsAuto = schedule.isAuto(timeKey, timeValue);
  const canRevert = canEdit && !timeIsAuto && Boolean(timeValue);

  return (
    <section
      aria-label={isDeparting ? "Departing garage" : "Returning garage"}
      className="rounded-xl border border-bone bg-mist/40 p-4"
    >
      <h4 className="mb-3 text-body-sm font-semibold text-ink">
        {isDeparting ? "Departing Garage" : "Returning Garage"}
      </h4>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_165px_180px]">
        <Select
          value={garageId ?? NONE}
          onValueChange={(value) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_garage_id" : "returning_garage_id"]:
                value === NONE ? null : value,
            })
          }
          disabled={!canEdit}
        >
          <SelectTrigger aria-label="Garage">
            <SelectValue placeholder="Garage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No garage</SelectItem>
            {lookups.garages.length === 0 ? (
              <SelectEmpty
                message="No garages yet. Dead miles are measured from one."
                href="/settings/garages"
                linkLabel="Add a garage"
              />
            ) : (
              lookups.garages.map((garage) => (
                <SelectItem key={garage.id} value={garage.id}>
                  {garage.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <LockedField value={isDeparting ? "Departing" : "Returning"} />

        <DateField
          value={dateValue}
          disabled={!canEdit}
          auto={schedule.isAuto(timeKey, timeValue)}
          onChange={(value) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_date" : "returning_date"]: value,
            })
          }
        />

        <div className="flex items-center gap-1">
          <TimeField
            className="flex-1"
            label={isDeparting ? "Depart Time" : "Arrive Time"}
            value={timeValue}
            disabled={!canEdit}
            auto={timeIsAuto}
            onChange={(value) =>
              setTrip(trip.id, {
                [isDeparting ? "departing_time" : "returning_time"]: value,
              })
            }
          />
          {canRevert && (
            <RevertButton
              label="Go back to the calculated time"
              onClick={() =>
                setTrip(trip.id, {
                  [isDeparting ? "departing_time" : "returning_time"]: null,
                })
              }
            />
          )}
        </div>
      </div>

      {/* Optional extras, folded away until an operator asks for them. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
        {canEdit && !showNote && !note && (
          <DisclosureButton label="Add Note" onClick={() => setShowNote(true)} />
        )}

        {isDeparting &&
          canEdit &&
          !showArrival &&
          !trip.departing_arrival_time && (
            <DisclosureButton
              label="Add Arrival Time"
              onClick={() => setShowArrival(true)}
            />
          )}

        {isDeparting && (showArrival || trip.departing_arrival_time) && (
          <TimeField
            className="w-40"
            label="Arrival Time"
            value={trip.departing_arrival_time}
            disabled={!canEdit}
            onChange={(value) =>
              setTrip(trip.id, { departing_arrival_time: value })
            }
          />
        )}

        {!isDeparting && canEdit && !showDistance && (
          <DisclosureButton
            label="Adjust distance from last stop"
            onClick={() => setShowDistance(true)}
          />
        )}

        {!isDeparting && showDistance && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-ash">
              From last stop
            </span>
            <NumericInput
              className="h-9 w-24"
              aria-label="Distance from last stop in kilometres"
              suffix="km"
              value={trip.return_leg_miles}
              onValueChange={(value) =>
                setTrip(trip.id, { return_leg_miles: value ?? 0 })
              }
            />
            <NumericInput
              className="h-9 w-20"
              aria-label="Drive time from last stop in minutes"
              suffix="min"
              value={trip.return_leg_minutes}
              onValueChange={(value) =>
                setTrip(trip.id, { return_leg_minutes: Math.round(value ?? 0) })
              }
            />
          </div>
        )}
      </div>

      {(showNote || note) && (
        <Input
          aria-label={isDeparting ? "Departing note" : "Returning note"}
          placeholder={
            isDeparting
              ? "Note for the yard before this trip"
              : "Note for the yard after this trip"
          }
          className="mt-3"
          value={note ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_note" : "returning_note"]:
                e.target.value || null,
            })
          }
        />
      )}
    </section>
  );
}
