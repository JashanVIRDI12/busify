import "server-only";

import { cache } from "react";

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
  files: Pick<Tables<"quote_files">, "id" | "name" | "size_bytes">[];
};

type QuoteBuilderRow = Tables<"quotes"> & {
  customer: Tables<"customers"> | null;
  billing_customer: Tables<"customers"> | null;
  trips: BuilderTrip[];
  payment_methods: Tables<"quote_payment_methods">[];
  files: (Pick<
    Tables<"quote_files">,
    "id" | "name" | "size_bytes"
  > & { created_at: string })[];
};

/**
 * Everything the builder page needs for one quote. RLS scopes it.
 *
 * PostgREST embeds the quote-owned rows in one response. Previously the three
 * trip-child queries selected every row in the organization and discarded
 * unrelated trips in JavaScript, so loading one quote became slower as the
 * entire account accumulated history.
 */
export const getQuoteForBuilder = cache(async function getQuoteForBuilder(
  id: string,
): Promise<QuoteBuilderData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .select(`
      *,
      customer:customers!quotes_organization_id_customer_id_fkey(*),
      billing_customer:customers!quotes_billing_customer_fk(*),
      trips:quote_trips(
        *,
        stops:quote_trip_stops(*),
        vehicles:quote_trip_vehicles(*),
        charges:quote_trip_charges(*)
      ),
      payment_methods:quote_payment_methods(*),
      files:quote_files(id, name, size_bytes, created_at)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as QuoteBuilderRow;
  const {
    customer,
    billing_customer: billingCustomer,
    trips: embeddedTrips,
    payment_methods: paymentMethods,
    files,
    ...quote
  } = row;

  const trips = [...(embeddedTrips ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((trip) => ({
      ...trip,
      stops: [...(trip.stops ?? [])].sort((a, b) => a.position - b.position),
      vehicles: [...(trip.vehicles ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
      charges: [...(trip.charges ?? [])].sort((a, b) => a.position - b.position),
    }));

  return {
    quote,
    customer,
    billingCustomer,
    trips,
    paymentMethods: [...(paymentMethods ?? [])].sort(
      (a, b) => a.position - b.position,
    ),
    files: [...(files ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id: fileId, name, size_bytes }) => ({
        id: fileId,
        name,
        size_bytes,
      })),
  };
});
