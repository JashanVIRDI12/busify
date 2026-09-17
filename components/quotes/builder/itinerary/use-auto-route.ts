"use client";

import { useEffect, useRef, useState } from "react";

import { routeItineraryAction } from "@/app/(dashboard)/quotes/geo-actions";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";

export type RoutingState = "idle" | "measuring" | "failed";

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
export function useAutoRoute(trip: QuoteTripInput): RoutingState {
  const { setStop, setTrip, lookups, canEdit } = useBuilder();
  const [state, setState] = useState<RoutingState>("idle");

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

    if (departing) {
      path.push({ id: "__garage_out__", address: departing, point: null });
    }

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

    if (returning) {
      path.push({ id: "__garage_back__", address: returning, point: null });
    }

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
