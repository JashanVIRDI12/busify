import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;

export type QuoteDetail = {
  quote: Quote;
  items: QuoteItem[];
  customer: Tables<"customers"> | null;
  request: Pick<
    Tables<"trip_requests">,
    "id" | "reference" | "pickup_location" | "destination" | "departure_at" | "return_at" | "passenger_count"
  > | null;
};

export async function getQuote(id: string): Promise<QuoteDetail | null> {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) return null;

  const [itemsResult, customerResult, requestResult] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("position"),
    quote.customer_id
      ? supabase.from("customers").select("*").eq("id", quote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    quote.trip_request_id
      ? supabase
          .from("trip_requests")
          .select(
            "id, reference, pickup_location, destination, departure_at, return_at, passenger_count",
          )
          .eq("id", quote.trip_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    quote,
    items: itemsResult.data ?? [],
    customer: customerResult.data,
    request: requestResult.data,
  };
}

export type PublicQuote = {
  quote: Pick<
    Quote,
    | "id"
    | "quote_number"
    | "status"
    | "subtotal"
    | "tax"
    | "tax_rate_percent"
    | "tax_province"
    | "discount"
    | "total"
    | "deposit_amount"
    | "currency"
    | "valid_until"
    | "notes"
    | "public_token"
  >;
  items: Pick<QuoteItem, "id" | "kind" | "description" | "quantity" | "unit_price" | "amount">[];
  organization: {
    name: string;
    phone: string | null;
    email: string | null;
    timezone: string;
    gst_hst_number: string | null;
  };
  customerName: string | null;
  trip: {
    pickup_location: string;
    destination: string;
    departure_at: string;
    return_at: string | null;
    passenger_count: number;
  } | null;
  expired: boolean;
};

/**
 * Load a quote for the customer-facing page, addressed only by its opaque token.
 *
 * Runs through the service-role client rather than opening `quotes` to `anon`.
 * An RLS policy cannot be parameterised by a token, so the anon-readable
 * version would have to be `using (true)` — every quote in the platform
 * readable by anyone. Instead the lookup stays server-side and returns a
 * hand-picked projection: no organization id, no customer id, no internal
 * timestamps.
 */
export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, organization_id, trip_request_id, customer_id, quote_number, status, subtotal, tax, tax_rate_percent, tax_province, discount, total, deposit_amount, currency, valid_until, notes, public_token",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error || !quote) return null;

  // A draft has not been sent to anyone yet, so it must not be viewable.
  if (quote.status === "DRAFT") return null;

  const [itemsResult, orgResult, customerResult, requestResult] = await Promise.all([
    supabase
      .from("quote_items")
      .select("id, kind, description, quantity, unit_price, amount")
      .eq("quote_id", quote.id)
      .order("position"),
    supabase
      .from("organizations")
      .select("name, phone, email, timezone, gst_hst_number")
      .eq("id", quote.organization_id)
      .maybeSingle(),
    quote.customer_id
      ? supabase
          .from("customers")
          .select("first_name, last_name")
          .eq("id", quote.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quote.trip_request_id
      ? supabase
          .from("trip_requests")
          .select(
            "pickup_location, destination, departure_at, return_at, passenger_count, contact_name",
          )
          .eq("id", quote.trip_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const organization = orgResult.data;
  if (!organization) return null;

  const customer = customerResult.data;
  const request = requestResult.data;

  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
    : (request?.contact_name ?? null);

  const expired = Boolean(
    quote.valid_until && new Date(`${quote.valid_until}T23:59:59Z`) < new Date(),
  );

  return {
    quote: {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      subtotal: quote.subtotal,
      tax: quote.tax,
      tax_rate_percent: quote.tax_rate_percent,
      tax_province: quote.tax_province,
      discount: quote.discount,
      total: quote.total,
      deposit_amount: quote.deposit_amount,
      currency: quote.currency,
      valid_until: quote.valid_until,
      notes: quote.notes,
      public_token: quote.public_token,
    },
    items: itemsResult.data ?? [],
    organization,
    customerName,
    trip: request
      ? {
          pickup_location: request.pickup_location,
          destination: request.destination,
          departure_at: request.departure_at,
          return_at: request.return_at,
          passenger_count: request.passenger_count,
        }
      : null,
    expired,
  };
}
