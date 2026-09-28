import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DriverPayLine = Tables<"driver_pay_entries"> & {
  driverName: string | null;
};

/** The measured drive into a stop from the one before it. */
export type StopLeg = { km: number; minutes: number };

/** Where a reservation's garage return sits among its stop positions. */
export const RETURN_LEG_POSITION = 9999;

export type ReservationTabData = {
  /** Every stop the coach makes, yard to yard, in order. */
  stops: Tables<"trip_stops">[];
  /**
   * The quote's measured legs, keyed by the stop position they arrive at —
   * Google's distances and drive times, which the stops' own timestamps cannot
   * give back once a wait or a multi-day stay sits between two of them. Empty
   * for a job entered straight onto the board.
   */
  legs: Record<number, StopLeg>;
  driverPay: DriverPayLine[];
  tickets: Tables<"tickets">[];
  /** Priced lines from the quote this reservation came from, when it had one. */
  items: Tables<"quote_items">[];
};

/**
 * Everything the reservation's secondary tabs need, in one round trip.
 *
 * Fetched together rather than per tab because the project is a long way from
 * the people using it: three sequential reads would cost about a second before
 * anything rendered, while three parallel ones cost the slowest of them. The
 * tabs then switch instantly, with no loading state, which is the point of
 * tabs — a tab that fetches is just a slow link.
 */
export async function getReservationTabData(
  tripId: string,
  quoteId: string | null,
  quoteTripId: string | null = null,
): Promise<ReservationTabData> {
  const supabase = await createClient();

  const [stopResult, payResult, ticketResult, itemResult, legResult] = await Promise.all([
    supabase
      .from("trip_stops")
      .select("*")
      .eq("trip_id", tripId)
      .order("position", { ascending: true }),
    supabase
      .from("driver_pay_entries")
      .select("*, drivers(first_name, last_name)")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tickets")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    // Charges are stored against the quote, not copied onto the reservation, so
    // a job sold without a quote simply has no breakdown to show.
    quoteId
      ? supabase
          .from("quote_items")
          .select("*")
          .eq("quote_id", quoteId)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Tables<"quote_items">[] }),
    quoteTripId
      ? supabase
          .from("quote_trips")
          .select(
            "returning_garage_id, return_leg_miles, return_leg_minutes, quote_trip_stops(position, leg_miles, leg_minutes)",
          )
          .eq("id", quoteTripId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Stops convert position for position, so the quote's leg into stop N is the
  // reservation's leg into stop N. The return leg lands on the garage row.
  const legs: Record<number, StopLeg> = {};
  const quoteTrip = legResult.data;
  for (const stop of quoteTrip?.quote_trip_stops ?? []) {
    legs[stop.position] = {
      km: Number(stop.leg_miles ?? 0),
      minutes: Number(stop.leg_minutes ?? 0),
    };
  }
  if (quoteTrip?.returning_garage_id) {
    legs[RETURN_LEG_POSITION] = {
      km: Number(quoteTrip.return_leg_miles ?? 0),
      minutes: Number(quoteTrip.return_leg_minutes ?? 0),
    };
  }

  const driverPay = (payResult.data ?? []).map((row) => {
    const { drivers, ...entry } = row as typeof row & {
      drivers: { first_name: string | null; last_name: string | null } | null;
    };

    return {
      ...(entry as Tables<"driver_pay_entries">),
      driverName: drivers
        ? [drivers.first_name, drivers.last_name].filter(Boolean).join(" ")
        : null,
    };
  });

  return {
    stops: stopResult.data ?? [],
    legs,
    driverPay,
    tickets: ticketResult.data ?? [],
    items: itemResult.data ?? [],
  };
}
