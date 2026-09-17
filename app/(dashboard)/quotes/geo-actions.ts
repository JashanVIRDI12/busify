"use server";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { geoProvider } from "@/lib/services/geo";

/**
 * Address lookup and itinerary routing for the quote builder.
 *
 * Server actions rather than a route handler so the provider key never reaches
 * the browser, and so the session check is the same one every other write path
 * uses. Both are read-only against the provider — nothing here touches the
 * database.
 */

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
};

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const stopSchema = z.object({
  id: z.string(),
  address: z.string().trim().max(300),
  point: pointSchema.nullable(),
});

export type RoutedStop = {
  id: string;
  /** Distance and drive time from the *previous* point on the path. */
  legMiles: number;
  legMinutes: number;
  /** Filled in when the address had to be geocoded to place it. */
  resolved: AddressSuggestion | null;
};

export type RouteItineraryResult =
  | {
      ok: true;
      stops: RoutedStop[];
      totalMiles: number;
      totalMinutes: number;
      /** Provider that answered, so the UI can say how good the number is. */
      provider: string;
      /** Addresses that could not be placed, by stop id. */
      unresolved: string[];
    }
  | { ok: false; message: string };

const routeInputSchema = z.object({
  stops: z.array(stopSchema).min(2).max(25),
});

/**
 * Measures a whole itinerary in one call.
 *
 * Takes the stops in order — including the departing and returning garage when
 * the trip has them — geocodes any that arrive without coordinates, then asks
 * the provider for road distance and drive time leg by leg.
 *
 * Legs are returned against the stop they arrive *at*, which is how the
 * itinerary stores them: every stop knows the distance from the one before it,
 * and the first stop on the path therefore has a zero leg.
 */
export async function routeItineraryAction(
  input: unknown,
): Promise<RouteItineraryResult> {
  await requireSession();

  const parsed = routeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Add at least two stops with addresses." };
  }

  const provider = geoProvider();
  const unresolved: string[] = [];
  const resolvedById = new Map<string, AddressSuggestion | null>();

  // Geocode sequentially rather than in parallel: Nominatim's fair-use policy
  // is one request per second, and a burst of eight gets the whole install
  // blocked rather than rate-limited.
  const placed: { id: string; point: { lat: number; lng: number } }[] = [];

  for (const stop of parsed.data.stops) {
    if (stop.point) {
      placed.push({ id: stop.id, point: stop.point });
      resolvedById.set(stop.id, null);
      continue;
    }

    if (!stop.address) {
      unresolved.push(stop.id);
      continue;
    }

    const hit = await provider.geocode(stop.address);
    if (!hit) {
      unresolved.push(stop.id);
      continue;
    }

    placed.push({ id: stop.id, point: { lat: hit.lat, lng: hit.lng } });
    resolvedById.set(stop.id, hit);
  }

  if (placed.length < 2) {
    return {
      ok: false,
      message:
        provider.canGeocode
          ? "Could not place enough of those addresses to measure a route."
          : "Address lookup is not configured, so distances must be entered by hand.",
    };
  }

  const route = await provider.route(placed.map((entry) => entry.point));
  if (!route) {
    return {
      ok: false,
      message: "The routing service did not answer. Try again in a moment.",
    };
  }

  // route.legs[i] is the leg *into* placed[i + 1].
  const stops: RoutedStop[] = placed.map((entry, index) => ({
    id: entry.id,
    legMiles: index === 0 ? 0 : (route.legs[index - 1]?.miles ?? 0),
    legMinutes: index === 0 ? 0 : (route.legs[index - 1]?.minutes ?? 0),
    resolved: resolvedById.get(entry.id) ?? null,
  }));

  return {
    ok: true,
    stops,
    totalMiles: route.totalMiles,
    totalMinutes: route.totalMinutes,
    provider: provider.name,
    unresolved,
  };
}
