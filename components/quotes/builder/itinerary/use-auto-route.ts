"use client";

import { useEffect, useRef, useState } from "react";

import { routeItineraryAction } from "@/app/(dashboard)/quotes/geo-actions";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "../builder-context";

export type RoutingState = "idle" | "measuring" | "failed";

export type AutoRoute = {
  state: RoutingState;
  /**
   * A garage chosen on this trip that could not be put on the map, by name.
   * Its dead leg is missing from the totals, which would otherwise read as a
   * trip with no deadhead at all.
   */
  unplacedGarage: string | null;
};

const GARAGE_OUT = "__garage_out__";
const GARAGE_BACK = "__garage_back__";

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
export function useAutoRoute(trip: QuoteTripInput): AutoRoute {
  const { setStop, setTrip, lookups, canEdit } = useBuilder();
  const [state, setState] = useState<RoutingState>("idle");
  const [unresolvedGarage, setUnresolvedGarage] = useState<string | null>(null);

  const garageOf = (id: string | null) =>
    id ? (lookups.garages.find((g) => g.id === id) ?? null) : null;

  const departing = garageOf(trip.departing_garage_id);
  const returning = garageOf(trip.returning_garage_id);

  // A yard with neither a saved point nor an address cannot be measured from,
  // and says so without waiting for a router to fail on it.
  const blank = [departing, returning].find(
    (garage) => garage && !garage.point && !garage.address,
  );

  // What the route actually depends on: where the yards are, and the stop
  // addresses in order.
  //
  // Everything this effect *writes* is deliberately absent — leg distances, and
  // the coordinates it caches back onto a geocoded stop. Including either would
  // make the effect retrigger on its own output: leg distances forever, and
  // coordinates once per address, which is a second round trip to a geocoder
  // that is rate-limited to about one request a second.
  const fingerprint = JSON.stringify([
    departing && [departing.address, departing.point],
    returning && [returning.address, returning.point],
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

    // The saved point when the garage has one, so the yard is never re-geocoded
    // and never lands somewhere else; its full address when it does not.
    const yard = (id: string, garage: typeof departing) =>
      garage && (garage.point || garage.address)
        ? { id, address: garage.address ?? "", point: garage.point }
        : null;

    const out = yard(GARAGE_OUT, departing);
    if (out) path.push(out);

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

    const back = yard(GARAGE_BACK, returning);
    if (back) path.push(back);

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

        // Only the yards are reported here; a stop the router could not place
        // keeps its own leg blank where the operator can see it.
        const lost = result.unresolved.includes(GARAGE_OUT)
          ? departing
          : result.unresolved.includes(GARAGE_BACK)
            ? returning
            : null;
        setUnresolvedGarage(lost?.id ?? null);

        for (const routed of result.stops) {
          if (routed.id === GARAGE_OUT) continue;

          if (routed.id === GARAGE_BACK) {
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

  // Only while that garage is still the one chosen — switching yards or
  // clearing it must not leave the warning behind.
  const lost = [departing, returning].find(
    (garage) => garage && garage.id === unresolvedGarage,
  );

  return { state, unplacedGarage: (blank ?? lost)?.name ?? null };
}
