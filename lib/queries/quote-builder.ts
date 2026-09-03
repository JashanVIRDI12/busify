import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type BuilderTrip = Tables<"quote_trips"> & {
  stops: Tables<"quote_trip_stops">[];
  vehicles: Tables<"quote_trip_vehicles">[];
  charges: Tables<"quote_trip_charges">[];
};

export type QuoteBuilderData = {
  quote: Tables<"quotes">;
  customer: Tables<"customers"> | null;
  billingCustomer: Tables<"customers"> | null;
  trips: BuilderTrip[];
  paymentMethods: Tables<"quote_payment_methods">[];
};

/** Everything the builder page needs for one quote. RLS scopes it. */
export async function getQuoteForBuilder(
  id: string,
): Promise<QuoteBuilderData | null> {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) return null;

  const [
    tripsResult,
    stopsResult,
    vehiclesResult,
    chargesResult,
    methodsResult,
    customerResult,
    billingResult,
  ] = await Promise.all([
    supabase
      .from("quote_trips")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position"),
    supabase
      .from("quote_trip_stops")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .order("position"),
    supabase
      .from("quote_trip_vehicles")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .order("position"),
    supabase
      .from("quote_trip_charges")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .order("position"),
    supabase
      .from("quote_payment_methods")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position"),
    quote.customer_id
      ? supabase.from("customers").select("*").eq("id", quote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    quote.billing_customer_id
      ? supabase
          .from("customers")
          .select("*")
          .eq("id", quote.billing_customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const tripIds = new Set((tripsResult.data ?? []).map((trip) => trip.id));

  const stopsByTrip = groupBy(stopsResult.data ?? [], "quote_trip_id", tripIds);
  const vehiclesByTrip = groupBy(vehiclesResult.data ?? [], "quote_trip_id", tripIds);
  const chargesByTrip = groupBy(chargesResult.data ?? [], "quote_trip_id", tripIds);

  const trips: BuilderTrip[] = (tripsResult.data ?? []).map((trip) => ({
    ...trip,
    stops: stopsByTrip.get(trip.id) ?? [],
    vehicles: vehiclesByTrip.get(trip.id) ?? [],
    charges: chargesByTrip.get(trip.id) ?? [],
  }));

  return {
    quote,
    customer: customerResult.data,
    billingCustomer: billingResult.data,
    trips,
    paymentMethods: methodsResult.data ?? [],
  };
}

function groupBy<T extends Record<K, string>, K extends string>(
  rows: T[],
  key: K,
  keep: Set<string>,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = row[key];
    if (!keep.has(id)) continue;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}
