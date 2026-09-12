"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  Clock,
  GripVertical,
  Loader2,
  Plus,
  Route,
  StickyNote,
  Trash2,
} from "lucide-react";

import { routeItineraryAction } from "@/app/(dashboard)/quotes/geo-actions";
import { AddressField } from "@/components/quotes/builder/address-field";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectEmpty,
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
        <AddressField
          className="lg:col-span-1"
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

/**
 * Measures the whole itinerary against a real road network, by itself.
 *
 * There is no button. An operator who has typed two addresses has already said
 * everything the router needs, and asking them to then press "calculate" is
 * asking them to do the computer a favour. It watches the addresses instead and
 * measures when they settle.
 *
 * It writes only the per-leg numbers. The effect in `Itinerary` already derives
 * total, live and dead miles plus drive time from those legs, so exactly one
 * place owns the roll-up and this is not it.
 *
 * The garages bracket the path: miles before the first stop and after the last
 * are dead miles, which is precisely the leg out of the departing garage and
 * the leg back to the returning one.
 */
function useAutoRoute(trip: QuoteTripInput) {
  const { setStop, setTrip, lookups, canEdit } = useBuilder();
  const [state, setState] = useState<"idle" | "measuring" | "failed">("idle");

  const garageAddress = (id: string | null) =>
    id ? (lookups.garages.find((g) => g.id === id)?.address ?? null) : null;

  const departing = garageAddress(trip.departing_garage_id);
  const returning = garageAddress(trip.returning_garage_id);

  // What the route actually depends on: the addresses, in order.
  //
  // Everything this effect *writes* is deliberately absent — leg distances, and
  // the coordinates it caches back onto a geocoded stop. Including either would
  // make the effect retrigger on its own output: leg distances forever, and
  // coordinates once per address, which is a second round trip to a geocoder
  // that is rate-limited to about one request a second.
  const fingerprint = JSON.stringify([
    departing,
    returning,
    trip.stops.map((stop) => [stop.id, (stop.address ?? "").trim()]),
  ]);

  const lastRouted = useRef<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    if (lastRouted.current === fingerprint) return;

    const path: {
      id: string;
      address: string;
      point: { lat: number; lng: number } | null;
    }[] = [];

    if (departing) path.push({ id: "__garage_out__", address: departing, point: null });

    for (const stop of trip.stops) {
      const address = (stop.address ?? "").trim();
      if (!address) continue;
      path.push({
        id: stop.id,
        address,
        point:
          stop.latitude != null && stop.longitude != null
            ? { lat: stop.latitude, lng: stop.longitude }
            : null,
      });
    }

    if (returning) path.push({ id: "__garage_back__", address: returning, point: null });

    if (path.length < 2) return;

    // Debounced well past a typing pause: the free geocoder allows about one
    // request a second, and a burst gets the whole install blocked rather than
    // throttled.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState("measuring");
      try {
        const result = await routeItineraryAction({ stops: path });
        if (cancelled) return;

        if (!result.ok) {
          setState("failed");
          return;
        }

        lastRouted.current = fingerprint;

        for (const routed of result.stops) {
          if (routed.id === "__garage_out__") continue;

          if (routed.id === "__garage_back__") {
            setTrip(trip.id, {
              return_leg_miles: routed.legMiles,
              return_leg_minutes: routed.legMinutes,
            });
            continue;
          }

          setStop(trip.id, routed.id, {
            leg_miles: routed.legMiles,
            leg_minutes: routed.legMinutes,
            // Keep what the provider matched, so the next run skips the lookup.
            ...(routed.resolved
              ? { latitude: routed.resolved.lat, longitude: routed.resolved.lng }
              : {}),
          });
        }

        setState("idle");
      } catch {
        if (!cancelled) setState("failed");
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, canEdit]);

  return state;
}

export function Itinerary({ trip }: { trip: QuoteTripInput }) {
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

      {canEdit && routing !== "idle" && (
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-ash">
          {routing === "measuring" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Measuring distance and drive time…
            </>
          ) : (
            <>
              <Route className="size-3.5" />
              Could not measure this route — enter the distances by hand.
            </>
          )}
        </div>
      )}

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
