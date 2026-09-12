import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { zonedTimeToUtc } from "@/lib/datetime";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ConversionResult =
  | { ok: true; created: number; tripIds: string[]; alreadyExisted: boolean }
  | { ok: false; message: string };

/**
 * Turn a won quote into the reservations that will actually be dispatched.
 *
 * This is the seam between selling and operating, and until it existed the
 * right-hand half of the product was unreachable: a quote built in the builder
 * produced `quote_trips`, but the board, the assignment timeline and driver pay
 * all read `trips`.
 *
 * One reservation per trip tab. They are inserted one at a time rather than in
 * a batch because `app.assign_trip_reference()` numbers each row by counting
 * the siblings already present — a batch insert would see zero siblings for
 * every row and hand them all the same number.
 *
 * Idempotent: a quote that already has reservations returns them untouched.
 * Accepting twice, or converting a quote the customer also accepted online,
 * must not double-book a coach.
 */
export async function convertQuoteToReservations(
  supabase: Client,
  quoteId: string,
  timeZone: string,
): Promise<ConversionResult> {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, organization_id, customer_id, company_id, title, event_name, pickup_at",
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError || !quote) {
    return { ok: false, message: "That quote could not be found." };
  }

  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("quote_id", quoteId);

  if (existing && existing.length > 0) {
    return {
      ok: true,
      created: 0,
      tripIds: existing.map((trip) => trip.id),
      alreadyExisted: true,
    };
  }

  const { data: tripRows, error: tripsError } = await supabase
    .from("quote_trips")
    .select(
      `id, position, name, passenger_count, total,
       departing_garage_id, departing_date, departing_time,
       returning_garage_id, returning_date, returning_time,
       notes,
       quote_trip_stops(position, kind, label, address, stop_date, stop_time, spot_time),
       quote_trip_vehicles(position, vehicle_id, vehicle_type_id, quantity)`,
    )
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });

  if (tripsError) {
    return { ok: false, message: "That quote's trips could not be read." };
  }
  if (!tripRows || tripRows.length === 0) {
    return { ok: false, message: "This quote has no trips to convert." };
  }

  const tripIds: string[] = [];

  for (const trip of tripRows) {
    const stops = [...(trip.quote_trip_stops ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const first = stops[0];
    const last = stops.length > 1 ? stops[stops.length - 1] : undefined;
    // Where the group is going, which on a round trip is not the last stop —
    // that is back where they started. The first stop somewhere else is it.
    const destination =
      stops.slice(1).find((stop) => placeOf(stop) !== placeOf(first)) ?? last;

    // A reservation must have a departure. Preference order: the first stop,
    // then the garage departure, then the quote's denormalised pickup. A trip
    // with none of those is not schedulable and is reported rather than
    // silently given today's date.
    const departureAt =
      combine(first?.stop_date, first?.stop_time, timeZone) ??
      combine(trip.departing_date, trip.departing_time, timeZone) ??
      quote.pickup_at;

    if (!departureAt) {
      return {
        ok: false,
        message: `"${trip.name}" has no pickup date yet. Add one before converting.`,
      };
    }

    const returnAt =
      combine(trip.returning_date, trip.returning_time, timeZone) ??
      combine(last?.stop_date, last?.stop_time, timeZone);

    const { data: created, error: insertError } = await supabase
      .from("trips")
      .insert({
        organization_id: quote.organization_id,
        quote_id: quote.id,
        customer_id: quote.customer_id,
        company_id: quote.company_id,
        garage_id: trip.departing_garage_id,
        pickup_location: placeOf(first) ?? "Pickup to be confirmed",
        destination:
          placeOf(destination) ?? placeOf(first) ?? "Destination to be confirmed",
        // The quote's title names the group ("Buffalo Bills game day"); the
        // event is only its category ("Athletics"), so it is the fallback.
        group_name: titleAsGroup(quote.title) ?? quote.event_name,
        departure_at: departureAt,
        return_at: returnAt,
        // The operational clock the dispatch board reads.
        garage_arrival_at: combine(
          trip.departing_date,
          trip.departing_time,
          timeZone,
        ),
        spot_at: combine(first?.stop_date, first?.spot_time, timeZone),
        dropoff_at: combine(last?.stop_date, last?.stop_time, timeZone),
        passenger_count: trip.passenger_count ?? 1,
        status: "SCHEDULED",
        total_due: Number(trip.total ?? 0),
        payment_status: "UNPAID",
        notes: trip.notes,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      console.error("Quote conversion: reservation insert failed", insertError);
      return {
        ok: false,
        message:
          tripIds.length > 0
            ? `Created ${tripIds.length} reservation(s), then "${trip.name}" failed. Convert again to finish.`
            : "Those reservations could not be created.",
      };
    }

    tripIds.push(created.id);

    // One assignment row per coach the quote sold. A quote that names an
    // actual vehicle pre-fills it; one that only names a type leaves the row
    // empty, which is exactly what the board draws as "unassigned".
    const assignments = (trip.quote_trip_vehicles ?? []).flatMap((vehicle) =>
      Array.from({ length: Math.max(1, vehicle.quantity) }, () => ({
        organization_id: quote.organization_id,
        trip_id: created.id,
        vehicle_id: vehicle.vehicle_id,
        driver_id: null,
        role: "PRIMARY" as const,
      })),
    );

    if (assignments.length > 0) {
      const { error: assignError } = await supabase
        .from("trip_assignments")
        .insert(assignments);

      // Not fatal: the reservation exists and can be crewed by hand. Losing
      // the whole conversion over a placeholder row would be worse.
      if (assignError) {
        console.error("Quote conversion: assignments failed", assignError);
      }
    }
  }

  return { ok: true, created: tripIds.length, tripIds, alreadyExisted: false };
}

/** `2026-09-20` + `06:00:00` in the operator's zone → a UTC instant. */
function combine(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string,
): string | null {
  if (!date) return null;
  return zonedTimeToUtc(`${date}T${(time ?? "00:00").slice(0, 5)}`, timeZone);
}

/** The human name of a stop: what it is called, or failing that, where it is. */
function placeOf(
  stop: { label: string | null; address: string | null } | undefined,
): string | null {
  if (!stop) return null;
  const value = stop.label?.trim() || stop.address?.trim();
  return value && value.length > 0 ? value : null;
}

/** "New Quote" is the placeholder title, not a group worth recording. */
function titleAsGroup(title: string | null): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  return trimmed && trimmed !== "New Quote" ? trimmed : null;
}
