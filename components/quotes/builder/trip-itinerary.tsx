"use client";

import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Clock, GripVertical, MapPin, Plus, StickyNote, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { QuoteStopInput, QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";
import { NumericInput } from "./numeric-input";

const NONE = "__none__";

function legLabel(minutes: number, miles: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m · ${miles.toFixed(1)} km`;
}

function GarageRow({
  trip,
  which,
}: {
  trip: QuoteTripInput;
  which: "departing" | "returning";
}) {
  const { setTrip, lookups, canEdit } = useBuilder();
  const isDeparting = which === "departing";

  const garageId = isDeparting ? trip.departing_garage_id : trip.returning_garage_id;
  const note = isDeparting ? trip.departing_note : trip.returning_note;
  const dateValue = isDeparting ? trip.departing_date : trip.returning_date;
  const timeValue = isDeparting ? trip.departing_time : trip.returning_time;

  return (
    <div className="rounded-xl border border-bone bg-mist/30 p-4">
      <p className="mb-3 text-body-sm font-semibold text-ink">
        {isDeparting ? "Departing Garage" : "Returning Garage"}
      </p>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_150px_130px]">
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
          <SelectTrigger>
            <SelectValue placeholder="Garage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No garage</SelectItem>
            {lookups.garages.map((garage) => (
              <SelectItem key={garage.id} value={garage.id}>
                {garage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={isDeparting ? "Departing" : "Returning"}
          value={note ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_note" : "returning_note"]:
                e.target.value || null,
            })
          }
        />
        <Input
          type="date"
          value={dateValue ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_date" : "returning_date"]:
                e.target.value || null,
            })
          }
        />
        <Input
          type="time"
          value={timeValue ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              [isDeparting ? "departing_time" : "returning_time"]:
                e.target.value || null,
            })
          }
        />
      </div>

      {isDeparting ? (
        trip.departing_arrival_time || canEdit ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[12px] font-medium text-ash">Arrival time</span>
            <Input
              type="time"
              className="h-8 w-32"
              value={trip.departing_arrival_time ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                setTrip(trip.id, {
                  departing_arrival_time: e.target.value || null,
                })
              }
            />
          </div>
        ) : null
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] font-medium text-ash">
            Distance from last stop
          </span>
          <NumericInput
            className="h-8 w-24"
            suffix="km"
            value={trip.return_leg_miles}
            onValueChange={(value) =>
              setTrip(trip.id, { return_leg_miles: value ?? 0 })
            }
          />
          <NumericInput
            className="h-8 w-20"
            suffix="min"
            value={trip.return_leg_minutes}
            onValueChange={(value) =>
              setTrip(trip.id, { return_leg_minutes: Math.round(value ?? 0) })
            }
          />
        </div>
      )}
    </div>
  );
}

function StopRow({
  trip,
  stop,
  index,
  isFirst,
  isLast,
  cumulativeMiles,
  cumulativeMinutes,
}: {
  trip: QuoteTripInput;
  stop: QuoteStopInput;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  cumulativeMiles: number;
  cumulativeMinutes: number;
}) {
  const { setStop, removeStop, canEdit } = useBuilder();
  const controls = useDragControls();
  const [showNotes, setShowNotes] = useState(Boolean(stop.notes));

  const timeLabel = isFirst ? "Depart" : isLast ? "Arrive" : "Time";

  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "rounded-xl border p-4",
        isFirst
          ? "border-teal-200 bg-teal-50"
          : isLast
            ? "border-teal-200 bg-teal-50"
            : "border-bone bg-signal-white",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-body-sm font-semibold text-ink">
          {isFirst ? "Pickup" : isLast ? "Dropoff" : `Stop ${index + 1}`}
        </p>
        <div className="flex items-center gap-1">
          {!isFirst && !isLast && (
            <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-[11px] text-ash">
              {legLabel(cumulativeMinutes, cumulativeMiles)} from start
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onPointerDown={(event) => controls.start(event)}
              className="cursor-grab touch-none text-ash hover:text-ink active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="size-4" />
            </button>
          )}
          {canEdit && !isFirst && !isLast && (
            <button
              type="button"
              onClick={() => removeStop(trip.id, stop.id)}
              className="text-ash hover:text-destructive"
              aria-label="Remove stop"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_150px_130px]">
        <div className="relative lg:col-span-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ash" />
          <Input
            placeholder="Address"
            className="pl-9"
            value={stop.address ?? ""}
            disabled={!canEdit}
            onChange={(e) => setStop(trip.id, stop.id, { address: e.target.value || null })}
          />
        </div>
        <Input
          placeholder={isFirst ? "Pickup" : isLast ? "Dropoff" : "Label"}
          value={stop.label ?? ""}
          disabled={!canEdit}
          onChange={(e) => setStop(trip.id, stop.id, { label: e.target.value || null })}
        />
        <Input
          type="date"
          value={stop.stop_date ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setStop(trip.id, stop.id, { stop_date: e.target.value || null })
          }
        />
        <div className="flex flex-col gap-1">
          <Input
            type="time"
            aria-label={`${timeLabel} time`}
            value={stop.stop_time ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setStop(trip.id, stop.id, { stop_time: e.target.value || null })
            }
          />
          <span className="text-[10px] text-ash">{timeLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {!isFirst && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-ash">From previous</span>
            <NumericInput
              className="h-8 w-20"
              suffix="km"
              value={stop.leg_miles}
              onValueChange={(value) =>
                setStop(trip.id, stop.id, { leg_miles: value ?? 0 })
              }
            />
            <NumericInput
              className="h-8 w-16"
              suffix="m"
              value={stop.leg_minutes}
              onValueChange={(value) =>
                setStop(trip.id, stop.id, {
                  leg_minutes: Math.round(value ?? 0),
                })
              }
            />
          </div>
        )}
        {isFirst && (
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-ash" />
            <span className="text-[12px] font-medium text-ash">Spot time</span>
            <Input
              type="time"
              className="h-8 w-28"
              value={stop.spot_time ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                setStop(trip.id, stop.id, { spot_time: e.target.value || null })
              }
            />
          </div>
        )}
        {canEdit && !showNotes && !stop.notes && (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-600"
          >
            <StickyNote className="size-3.5" /> Add Notes
          </button>
        )}
      </div>

      {(showNotes || stop.notes) && (
        <Input
          placeholder="Notes for this stop"
          className="mt-3"
          value={stop.notes ?? ""}
          disabled={!canEdit}
          onChange={(e) => setStop(trip.id, stop.id, { notes: e.target.value || null })}
        />
      )}
    </Reorder.Item>
  );
}

export function Itinerary({ trip }: { trip: QuoteTripInput }) {
  const { reorderStops, addStop, setTrip, canEdit } = useBuilder();

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
    <div className="space-y-4">
      <GarageRow trip={trip} which="departing" />

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
            isFirst={index === 0}
            isLast={index === trip.stops.length - 1}
            cumulativeMiles={cumulative[index]?.miles ?? 0}
            cumulativeMinutes={cumulative[index]?.minutes ?? 0}
          />
        ))}
      </Reorder.Group>

      {canEdit && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => addStop(trip.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-bone bg-signal-white px-4 py-2 text-body-sm font-semibold text-ink hover:bg-mist"
          >
            <Plus className="size-4" /> Add Stop
          </button>
        </div>
      )}

      <GarageRow trip={trip} which="returning" />
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
