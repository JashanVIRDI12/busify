"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "@/lib/utils";
import { QUOTE_TRIP_TYPES } from "@/lib/validations/quote-builder";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";
import { Itinerary } from "./trip-itinerary";

const NONE = "__none__";

const TRIP_TYPE_LABELS: Record<string, string> = {
  ONE_WAY: "One way",
  ROUND_TRIP: "Round trip",
  HOURLY: "Hourly / as directed",
  DAILY: "Daily",
  SHUTTLE: "Shuttle",
  OTHER: "Other",
};

function TripContactFields({ trip }: { trip: QuoteTripInput }) {
  const { setTrip, canEdit } = useBuilder();
  return (
    <div className="grid gap-3 rounded-xl border border-bone bg-mist/40 p-4 sm:grid-cols-3">
      <Input
        placeholder="Contact name"
        value={trip.trip_contact_name ?? ""}
        disabled={!canEdit}
        onChange={(e) => setTrip(trip.id, { trip_contact_name: e.target.value || null })}
      />
      <Input
        placeholder="Contact email"
        type="email"
        value={trip.trip_contact_email ?? ""}
        disabled={!canEdit}
        onChange={(e) => setTrip(trip.id, { trip_contact_email: e.target.value || null })}
      />
      <Input
        placeholder="Contact phone"
        value={trip.trip_contact_phone ?? ""}
        disabled={!canEdit}
        onChange={(e) => setTrip(trip.id, { trip_contact_phone: e.target.value || null })}
      />
    </div>
  );
}

export function TripDetails({ trip }: { trip: QuoteTripInput }) {
  const { setTrip, setVehicle, addVehicle, removeVehicle, lookups, canEdit, computed } =
    useBuilder();
  const [showContact, setShowContact] = useState(
    Boolean(trip.trip_contact_name || trip.trip_contact_email || trip.trip_contact_phone),
  );

  const result = computed.byTrip[trip.id];
  const estimatedHours = result ? Math.floor(trip.estimated_minutes / 60) : 0;
  const estimatedMins = trip.estimated_minutes % 60;

  function prefillRatesFromType(typeId: string) {
    const type = lookups.vehicleTypes.find((entry) => entry.id === typeId);
    if (!type) return;
    const untouched =
      trip.rate_daily === 0 &&
      trip.rate_hourly === 0 &&
      trip.rate_per_mile === 0 &&
      trip.rate_flat_base === 0;
    if (untouched) {
      setTrip(trip.id, {
        rate_daily: Number(type.per_day_rate) || 0,
        rate_hourly: Number(type.per_hour_rate) || 0,
        rate_per_mile: Number(type.per_km_rate) || 0,
        rate_flat_base: Number(type.base_rate) || 0,
        passenger_count:
          trip.passenger_count ?? type.default_capacity ?? null,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* --- Top row --- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px]">
        <Select
          value={trip.trip_type ?? NONE}
          onValueChange={(value) =>
            setTrip(trip.id, {
              trip_type: value === NONE ? null : (value as QuoteTripInput["trip_type"]),
            })
          }
          disabled={!canEdit}
        >
          <SelectTrigger>
            <SelectValue placeholder="Trip Type" />
          </SelectTrigger>
          <SelectContent>
            {QUOTE_TRIP_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {TRIP_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          placeholder="Passengers (e.g. 30)"
          value={trip.passenger_count ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              passenger_count: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
        <Input
          type="number"
          min={0}
          placeholder="Drivers (e.g. 1)"
          value={trip.driver_count ?? ""}
          disabled={!canEdit}
          onChange={(e) =>
            setTrip(trip.id, {
              driver_count: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </div>

      {/* --- Vehicles --- */}
      <div className="space-y-3">
        {trip.vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
          >
            <Select
              value={vehicle.vehicle_type_id ?? NONE}
              onValueChange={(value) => {
                const typeId = value === NONE ? null : value;
                setVehicle(trip.id, vehicle.id, { vehicle_type_id: typeId });
                if (typeId) prefillRatesFromType(typeId);
              }}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {lookups.vehicleTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                    {type.default_capacity ? ` · ${type.default_capacity} seats` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={!canEdit || vehicle.quantity <= 1}
                onClick={() =>
                  setVehicle(trip.id, vehicle.id, {
                    quantity: Math.max(1, vehicle.quantity - 1),
                  })
                }
              >
                <Minus />
              </Button>
              <span className="tabular w-8 text-center text-body-sm font-semibold">
                {vehicle.quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={!canEdit}
                onClick={() =>
                  setVehicle(trip.id, vehicle.id, { quantity: vehicle.quantity + 1 })
                }
              >
                <Plus />
              </Button>
            </div>

            {trip.vehicles.length > 1 && canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeVehicle(trip.id, vehicle.id)}
                aria-label="Remove vehicle"
              >
                <Trash2 />
              </Button>
            ) : (
              <span className="w-8" />
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setShowContact(true)}
            className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-teal-600 disabled:opacity-50"
          >
            <Plus className="size-4" /> Add Trip Contact
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => addVehicle(trip.id)}
            className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-teal-600 disabled:opacity-50"
          >
            <Plus className="size-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {showContact && <TripContactFields trip={trip} />}

      <hr className="border-bone" />

      <Itinerary trip={trip} />

      {/* --- Footer metrics --- */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-bone pt-4 text-body-sm">
        <span className="text-slate">
          Total Distance:{" "}
          <span className="font-semibold text-ink">
            {formatDistance(trip.total_miles)}
          </span>
        </span>
        <span className="text-slate">
          Dead:{" "}
          <span className="font-semibold text-ink">
            {formatDistance(trip.dead_miles)}
          </span>
        </span>
        <span className="text-slate">
          Live:{" "}
          <span className="font-semibold text-ink">
            {formatDistance(trip.live_miles)}
          </span>
        </span>
        <span className="text-slate">
          Estimated Time:{" "}
          <span className="font-semibold text-ink">
            {estimatedHours}h {estimatedMins}m
          </span>
        </span>
      </div>
    </div>
  );
}
