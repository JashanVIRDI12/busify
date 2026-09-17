import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DriverPayLine = Tables<"driver_pay_entries"> & {
  driverName: string | null;
};

export type ReservationTabData = {
  /** Every stop the coach makes, yard to yard, in order. */
  stops: Tables<"trip_stops">[];
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
): Promise<ReservationTabData> {
  const supabase = await createClient();

  const [stopResult, payResult, ticketResult, itemResult] = await Promise.all([
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
  ]);

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
    driverPay,
    tickets: ticketResult.data ?? [],
    items: itemResult.data ?? [],
  };
}
