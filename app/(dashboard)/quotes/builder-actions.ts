"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { zonedTimeToUtc } from "@/lib/datetime";
import type { FormState } from "@/lib/forms";
import { canWriteFinance } from "@/lib/permissions";
import { toMajor } from "@/lib/pricing";
import { rollUpQuote, type TripPricingResult } from "@/lib/pricing/quote";
import { priceTripInput } from "@/lib/quotes/compute";
import { defaultTaxRate, describeTaxRate } from "@/lib/tax/canada";
import { uuid } from "@/lib/validations/shared";
import {
  quoteBuilderSchema,
  type QuoteBuilderInput,
  type QuoteTripInput,
} from "@/lib/validations/quote-builder";
import type { TablesInsert } from "@/types/database";

type SaveResult =
  | { ok: true; savedAt: string; totals: QuoteTotals }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type QuoteTotals = {
  subtotal: number;
  tax: number;
  total: number;
  dueNow: number;
  dueLater: number;
  perTrip: {
    id: string;
    baseFareTotal: number;
    subtotal: number;
    tax: number;
    total: number;
    dueNow: number;
    dueLater: number;
    candidates: { daily: number; hourly: number; mileage: number; base: number };
    selectedBasis: string;
  }[];
};

function revalidateQuote(id: string) {
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/dashboard");
}

/**
 * The first pickup across the whole quote: the earliest trip's first stop.
 *
 * Trips are ordered by their tab position rather than by date, so "Trip 2" can
 * legitimately run before "Trip 1" — the operator numbers tabs in the order
 * they sold them. The list wants the date the customer travels first, so this
 * takes the minimum rather than trip zero.
 */
function firstPickup(
  input: QuoteBuilderInput,
  timeZone: string,
): { at: string | null; address: string | null } {
  let best: { at: string; address: string | null } | null = null;

  for (const trip of input.trips) {
    const stop = [...trip.stops].sort((a, b) => a.position - b.position)[0];
    if (!stop?.stop_date) continue;

    const at = zonedTimeToUtc(
      `${stop.stop_date}T${(stop.stop_time ?? "00:00").slice(0, 5)}`,
      timeZone,
    );
    if (!at) continue;

    if (!best || at < best.at) best = { at, address: stop.address ?? null };
  }

  return { at: best?.at ?? null, address: best?.address ?? null };
}

// ---------------------------------------------------------------------------
// Create — a blank draft, or one seeded from a trip request
// ---------------------------------------------------------------------------

/** Card / Bank / Check / Wire / Other, in the order Busify shows them. */
function defaultPaymentMethods(quoteId: string, organizationId: string) {
  const base = { organization_id: organizationId, quote_id: quoteId };
  return [
    { ...base, method: "CARD" as const, position: 0, enabled: true, online_processing: true },
    { ...base, method: "BANK" as const, position: 1, enabled: true, online_processing: true },
    { ...base, method: "CHECK" as const, position: 2, enabled: true, online_processing: false },
    { ...base, method: "WIRE" as const, position: 3, enabled: false, online_processing: false },
    { ...base, method: "OTHER" as const, position: 4, enabled: false, online_processing: false },
  ];
}

/** The seed HST/GST tax row for a new trip, from the place of supply. */
function defaultTaxCharge(
  quoteTripId: string,
  organizationId: string,
  province: string | null,
  gstNumber: string | null,
): TablesInsert<"quote_trip_charges"> {
  const rate = defaultTaxRate(province);
  const label = gstNumber
    ? `${describeTaxRate(rate, province)}# ${gstNumber}`
    : describeTaxRate(rate, province);

  return {
    organization_id: organizationId,
    quote_trip_id: quoteTripId,
    section: "TAX",
    position: 0,
    label,
    kind: "PERCENT",
    rate,
    quantity: 1,
    amount: 0,
    taxable: false,
  };
}

async function seedQuote(options: {
  seedFromRequestId?: string;
}): Promise<string> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    throw new Error("Your role does not allow creating quotes.");
  }

  const org = session.organization;

  let request:
    | {
        id: string;
        customer_id: string | null;
        pickup_location: string;
        pickup_address: string | null;
        destination: string;
        destination_address: string | null;
        departure_at: string;
        return_at: string | null;
        passenger_count: number;
        special_requirements: string | null;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
      }
    | null = null;

  if (options.seedFromRequestId) {
    const { data } = await supabase
      .from("trip_requests")
      .select(
        "id, customer_id, pickup_location, pickup_address, destination, destination_address, departure_at, return_at, passenger_count, special_requirements, contact_name, contact_email, contact_phone",
      )
      .eq("id", options.seedFromRequestId)
      .maybeSingle();
    request = data;
  }

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      organization_id: org.id,
      trip_request_id: request?.id ?? null,
      customer_id: request?.customer_id ?? null,
      title: "New Quote",
      status: "DRAFT",
      pipeline_status: "LEAD",
      currency: org.currency,
      tax_province: org.state,
    })
    .select("id")
    .single();

  if (error || !quote) {
    console.error("Quote draft creation failed", error);
    throw new Error("Could not start a new quote.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("quote_trips")
    .insert({
      organization_id: org.id,
      quote_id: quote.id,
      position: 0,
      name: "Trip 1",
      trip_type: request ? (request.return_at ? "ROUND_TRIP" : "ONE_WAY") : null,
      passenger_count: request?.passenger_count ?? null,
      notes: request?.special_requirements ?? null,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    console.error("Quote trip creation failed", tripError);
    throw new Error("Could not start a new quote.");
  }

  await Promise.all([
    supabase
      .from("quote_payment_methods")
      .insert(defaultPaymentMethods(quote.id, org.id)),
    supabase
      .from("quote_trip_charges")
      .insert(defaultTaxCharge(trip.id, org.id, org.state, org.gst_hst_number)),
  ]);

  if (request) {
    // Two stops seeded from the request's endpoints.
    await supabase.from("quote_trip_stops").insert([
      {
        organization_id: org.id,
        quote_trip_id: trip.id,
        position: 0,
        kind: "PICKUP",
        label: "Pickup",
        address: request.pickup_address ?? request.pickup_location,
      },
      {
        organization_id: org.id,
        quote_trip_id: trip.id,
        position: 1,
        kind: "DROPOFF",
        label: "Dropoff",
        address: request.destination_address ?? request.destination,
      },
    ]);

    await supabase
      .from("trip_requests")
      .update({ status: "QUOTED" })
      .eq("id", request.id);
  }

  revalidatePath("/quotes");
  return quote.id;
}

export async function createQuoteDraftAction() {
  const id = await seedQuote({});
  redirect(`/quotes/${id}`);
}

export async function createQuoteFromRequestAction(formData: FormData) {
  const parsed = uuid.safeParse(formData.get("request_id"));
  if (!parsed.success) throw new Error("That request could not be found.");
  const id = await seedQuote({ seedFromRequestId: parsed.data });
  redirect(`/quotes/${id}`);
}

// ---------------------------------------------------------------------------
// Save — the whole builder, recomputed server-side
// ---------------------------------------------------------------------------

export async function saveQuoteBuilderAction(
  raw: QuoteBuilderInput,
): Promise<SaveResult> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow editing quotes." };
  }

  const parsed = quoteBuilderSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join(".") || "_form"] ??= []).push(issue.message);
    }
    return { ok: false, message: "Some fields need attention.", fieldErrors };
  }

  const input = parsed.data;
  const orgId = session.organization.id;

  const { data: existing, error: loadError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", input.id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: "This quote no longer exists." };
  }

  // --- Price every trip, server-side --------------------------------------
  const priced = input.trips.map((trip) => ({
    trip,
    result: priceTripInput(trip),
  }));
  const rollup = rollUpQuote(priced.map((entry) => entry.result));

  const primaryTax = priced[0]?.result.taxes[0];
  const pickup = firstPickup(input, session.organization.timezone);

  // --- Header ------------------------------------------------------------
  const header = input.header;
  const { error: headerError } = await supabase
    .from("quotes")
    .update({
      title: header.title,
      pipeline_status: header.pipeline_status,
      priority: header.priority,
      sales_rep_id: header.sales_rep_id,
      event_name: header.event_name,
      referred_by: header.referred_by,
      tags: header.tags,
      customer_id: header.customer_id,
      billing_customer_id: header.billing_customer_id,
      customer_visibility: header.customer_visibility,
      allow_instant_booking: header.allow_instant_booking,
      allow_pay_later: header.allow_pay_later,
      allow_full_card_payment: header.allow_full_card_payment,
      po_number: header.po_number,
      po_only: header.po_only,
      payment_policy: header.payment_policy,
      require_signature: header.require_signature,
      expiry_days: header.expiry_days,
      expiry_anchor: header.expiry_anchor,
      contract_terms_id: header.contract_terms_id,
      overage_basis: header.overage_basis,
      overage_rate: header.overage_rate,
      notes: header.notes,
      // Rolled-up totals — the legacy columns the dashboard and public page read.
      subtotal: toMajor(rollup.subtotal),
      tax: toMajor(rollup.taxTotal),
      discount: 0,
      total: toMajor(rollup.total),
      deposit_amount: toMajor(rollup.dueNow),
      tax_rate_percent: primaryTax ? primaryTax.rate : 0,
      // Denormalised so the quotes list can sort and filter on pickup without
      // reaching through quote_trips into quote_trip_stops.
      pickup_at: pickup.at,
      pickup_address: pickup.address,
    })
    .eq("id", input.id);

  if (headerError) return saveError(databaseError(headerError));

  // --- Payment methods (fixed set of up to five) ------------------------
  if (input.paymentMethods.length > 0) {
    const { error } = await supabase.from("quote_payment_methods").upsert(
      input.paymentMethods.map((method) => ({
        id: method.id,
        organization_id: orgId,
        quote_id: input.id,
        method: method.method,
        position: method.position,
        enabled: method.enabled,
        online_processing: method.online_processing,
        processing_fee_percent: method.processing_fee_percent,
        customer_note: method.customer_note,
      })),
      { onConflict: "id" },
    );
    if (error) return saveError(databaseError(error));
  }

  // --- Trips: delete removed, then upsert -------------------------------
  const tripIds = input.trips.map((trip) => trip.id);
  await pruneTrips(supabase, input.id, tripIds);

  const tripRows = priced.map(({ trip, result }) => ({
    id: trip.id,
    organization_id: orgId,
    quote_id: input.id,
    position: trip.position,
    name: trip.name,
    trip_type: trip.trip_type,
    passenger_count: trip.passenger_count,
    driver_count: trip.driver_count,
    trip_contact_name: trip.trip_contact_name,
    trip_contact_email: trip.trip_contact_email,
    trip_contact_phone: trip.trip_contact_phone,
    departing_garage_id: trip.departing_garage_id,
    departing_note: trip.departing_note,
    departing_date: trip.departing_date,
    departing_time: trip.departing_time,
    departing_arrival_time: trip.departing_arrival_time,
    returning_garage_id: trip.returning_garage_id,
    returning_note: trip.returning_note,
    returning_date: trip.returning_date,
    returning_time: trip.returning_time,
    return_leg_miles: trip.return_leg_miles,
    return_leg_minutes: trip.return_leg_minutes,
    base_fare_mode: trip.base_fare_mode,
    base_fare_basis: trip.base_fare_basis,
    rate_daily: trip.rate_daily,
    rate_hourly: trip.rate_hourly,
    rate_per_mile: trip.rate_per_mile,
    rate_flat_base: trip.rate_flat_base,
    base_fare_override: trip.base_fare_override,
    days: trip.days,
    hours: trip.hours,
    total_miles: trip.total_miles,
    dead_miles: trip.dead_miles,
    live_miles: trip.live_miles,
    estimated_minutes: trip.estimated_minutes,
    base_fare_total: toMajor(result.baseFareTotal),
    subtotal: toMajor(result.subtotal),
    tax_total: toMajor(result.taxTotal),
    total: toMajor(result.total),
    due_now_percent: trip.due_now_percent,
    due_now_amount: trip.due_now_amount,
    balance_due_date: trip.balance_due_date,
    recurrence: (trip.recurrence ?? null) as never,
    notes: trip.notes,
  }));

  const { error: tripError } = await supabase
    .from("quote_trips")
    .upsert(tripRows, { onConflict: "id" });
  if (tripError) return saveError(databaseError(tripError));

  // --- Per-trip children ----------------------------------------------
  for (const { trip, result } of priced) {
    const stopIds = trip.stops.map((stop) => stop.id);
    const vehicleIds = trip.vehicles.map((vehicle) => vehicle.id);
    const chargeIds = trip.charges.map((charge) => charge.id);

    await Promise.all([
      pruneStops(supabase, trip.id, stopIds),
      pruneVehicles(supabase, trip.id, vehicleIds),
      pruneCharges(supabase, trip.id, chargeIds),
    ]);

    if (trip.stops.length > 0) {
      const { error } = await supabase.from("quote_trip_stops").upsert(
        trip.stops.map((stop) => ({
          id: stop.id,
          organization_id: orgId,
          quote_trip_id: trip.id,
          position: stop.position,
          kind: stop.kind,
          label: stop.label,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
          stop_date: stop.stop_date,
          stop_time: stop.stop_time,
          spot_time: stop.spot_time,
          notes: stop.notes,
          leg_miles: stop.leg_miles,
          leg_minutes: stop.leg_minutes,
        })),
        { onConflict: "id" },
      );
      if (error) return saveError(databaseError(error));
    }

    if (trip.vehicles.length > 0) {
      const { error } = await supabase.from("quote_trip_vehicles").upsert(
        trip.vehicles.map((vehicle) => ({
          id: vehicle.id,
          organization_id: orgId,
          quote_trip_id: trip.id,
          position: vehicle.position,
          vehicle_type_id: vehicle.vehicle_type_id,
          vehicle_id: vehicle.vehicle_id,
          quantity: vehicle.quantity,
        })),
        { onConflict: "id" },
      );
      if (error) return saveError(databaseError(error));
    }

    if (trip.charges.length > 0) {
      // Amounts are the server engine's, indexed by original charge order.
      const chargeRows = trip.charges.map((charge, index) => ({
        id: charge.id,
        organization_id: orgId,
        quote_trip_id: trip.id,
        position: charge.position,
        section: charge.section,
        label: charge.label,
        kind: charge.kind,
        rate: charge.rate,
        quantity: charge.quantity,
        amount: toMajor(result.charges[index]?.amount ?? 0),
        taxable: charge.taxable,
      }));

      const { error } = await supabase
        .from("quote_trip_charges")
        .upsert(chargeRows, { onConflict: "id" });
      if (error) return saveError(databaseError(error));
    }
  }

  // --- Flattened quote_items mirror (public page + booking accept) -----
  await rebuildQuoteItems(supabase, orgId, input.id, priced);

  revalidateQuote(input.id);

  return {
    ok: true,
    savedAt: new Date().toISOString(),
    totals: {
      subtotal: toMajor(rollup.subtotal),
      tax: toMajor(rollup.taxTotal),
      total: toMajor(rollup.total),
      dueNow: toMajor(rollup.dueNow),
      dueLater: toMajor(rollup.dueLater),
      perTrip: priced.map(({ trip, result }) => ({
        id: trip.id,
        baseFareTotal: toMajor(result.baseFareTotal),
        subtotal: toMajor(result.subtotal),
        tax: toMajor(result.taxTotal),
        total: toMajor(result.total),
        dueNow: toMajor(result.dueNow),
        dueLater: toMajor(result.dueLater),
        candidates: {
          daily: toMajor(result.candidates.daily),
          hourly: toMajor(result.candidates.hourly),
          mileage: toMajor(result.candidates.mileage),
          base: toMajor(result.candidates.base),
        },
        selectedBasis: result.selectedBasis,
      })),
    },
  };
}

type BuilderSupabase = Awaited<ReturnType<typeof actionContext>>["supabase"];

/** databaseError() shapes for forms; this shapes it for the builder's result. */
function saveError(state: FormState): { ok: false; message: string } {
  return { ok: false, message: state.message ?? "Could not save the quote." };
}

async function pruneTrips(
  supabase: BuilderSupabase,
  quoteId: string,
  keepIds: string[],
) {
  const base = supabase.from("quote_trips").delete().eq("quote_id", quoteId);
  await (keepIds.length > 0
    ? base.not("id", "in", `(${keepIds.join(",")})`)
    : base);
}

async function pruneStops(supabase: BuilderSupabase, tripId: string, keep: string[]) {
  const base = supabase
    .from("quote_trip_stops")
    .delete()
    .eq("quote_trip_id", tripId);
  await (keep.length > 0 ? base.not("id", "in", `(${keep.join(",")})`) : base);
}

async function pruneVehicles(supabase: BuilderSupabase, tripId: string, keep: string[]) {
  const base = supabase
    .from("quote_trip_vehicles")
    .delete()
    .eq("quote_trip_id", tripId);
  await (keep.length > 0 ? base.not("id", "in", `(${keep.join(",")})`) : base);
}

async function pruneCharges(supabase: BuilderSupabase, tripId: string, keep: string[]) {
  const base = supabase
    .from("quote_trip_charges")
    .delete()
    .eq("quote_trip_id", tripId);
  await (keep.length > 0 ? base.not("id", "in", `(${keep.join(",")})`) : base);
}

async function rebuildQuoteItems(
  supabase: BuilderSupabase,
  orgId: string,
  quoteId: string,
  priced: { trip: QuoteTripInput; result: TripPricingResult }[],
) {
  await supabase.from("quote_items").delete().eq("quote_id", quoteId);

  const rows: TablesInsert<"quote_items">[] = [];
  let position = 0;

  for (const { trip, result } of priced) {
    const prefix = priced.length > 1 ? `${trip.name} — ` : "";

    rows.push({
      organization_id: orgId,
      quote_id: quoteId,
      kind: "VEHICLE",
      description: `${prefix}Base fare`,
      quantity: 1,
      unit_price: toMajor(result.baseFare),
      amount: toMajor(result.baseFare),
      position: position++,
    });

    for (const charge of [...result.baseFareCharges, ...result.itemizedCharges]) {
      rows.push({
        organization_id: orgId,
        quote_id: quoteId,
        kind: charge.section === "BASE_FARE" ? "OTHER" : "ADDITIONAL_SERVICE",
        description: `${prefix}${charge.label || "Charge"}`,
        quantity: 1,
        unit_price: toMajor(charge.amount),
        amount: toMajor(charge.amount),
        position: position++,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("quote_items").insert(rows);
  }
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export async function duplicateQuoteAction(formData: FormData) {
  const { session, supabase } = await actionContext();
  if (!canWriteFinance(session.role)) {
    throw new Error("Your role does not allow creating quotes.");
  }

  const source = uuid.safeParse(formData.get("quote_id"));
  if (!source.success) throw new Error("That quote could not be found.");

  const orgId = session.organization.id;

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", source.data)
    .maybeSingle();
  if (!quote) throw new Error("That quote could not be found.");

  const { data: copy, error } = await supabase
    .from("quotes")
    .insert({
      organization_id: orgId,
      trip_request_id: quote.trip_request_id,
      customer_id: quote.customer_id,
      billing_customer_id: quote.billing_customer_id,
      title: `${quote.title} (copy)`,
      status: "DRAFT",
      pipeline_status: "LEAD",
      priority: quote.priority,
      sales_rep_id: quote.sales_rep_id,
      currency: quote.currency,
      tax_province: quote.tax_province,
      customer_visibility: quote.customer_visibility,
      allow_instant_booking: quote.allow_instant_booking,
      allow_pay_later: quote.allow_pay_later,
      allow_full_card_payment: quote.allow_full_card_payment,
      payment_policy: quote.payment_policy,
      require_signature: quote.require_signature,
      expiry_days: quote.expiry_days,
      expiry_anchor: quote.expiry_anchor,
      contract_terms_id: quote.contract_terms_id,
      overage_basis: quote.overage_basis,
      overage_rate: quote.overage_rate,
    })
    .select("id")
    .single();

  if (error || !copy) throw new Error("Could not duplicate this quote.");

  await supabase
    .from("quote_payment_methods")
    .insert(defaultPaymentMethods(copy.id, orgId));

  const { data: trips } = await supabase
    .from("quote_trips")
    .select("*")
    .eq("quote_id", quote.id)
    .order("position");

  for (const trip of trips ?? []) {
    const { data: newTrip } = await supabase
      .from("quote_trips")
      .insert({
        organization_id: orgId,
        quote_id: copy.id,
        position: trip.position,
        name: trip.name,
        trip_type: trip.trip_type,
        passenger_count: trip.passenger_count,
        driver_count: trip.driver_count,
        trip_contact_name: trip.trip_contact_name,
        trip_contact_email: trip.trip_contact_email,
        trip_contact_phone: trip.trip_contact_phone,
        departing_garage_id: trip.departing_garage_id,
        departing_note: trip.departing_note,
        departing_date: trip.departing_date,
        departing_time: trip.departing_time,
        departing_arrival_time: trip.departing_arrival_time,
        returning_garage_id: trip.returning_garage_id,
        returning_note: trip.returning_note,
        returning_date: trip.returning_date,
        returning_time: trip.returning_time,
        return_leg_miles: trip.return_leg_miles,
        return_leg_minutes: trip.return_leg_minutes,
        base_fare_mode: trip.base_fare_mode,
        base_fare_basis: trip.base_fare_basis,
        rate_daily: trip.rate_daily,
        rate_hourly: trip.rate_hourly,
        rate_per_mile: trip.rate_per_mile,
        rate_flat_base: trip.rate_flat_base,
        base_fare_override: trip.base_fare_override,
        days: trip.days,
        hours: trip.hours,
        total_miles: trip.total_miles,
        dead_miles: trip.dead_miles,
        live_miles: trip.live_miles,
        estimated_minutes: trip.estimated_minutes,
        base_fare_total: trip.base_fare_total,
        subtotal: trip.subtotal,
        tax_total: trip.tax_total,
        total: trip.total,
        due_now_percent: trip.due_now_percent,
        due_now_amount: trip.due_now_amount,
        balance_due_date: trip.balance_due_date,
        recurrence: trip.recurrence,
        notes: trip.notes,
      })
      .select("id")
      .single();
    if (!newTrip) continue;

    const [{ data: stops }, { data: vehicles }, { data: charges }] =
      await Promise.all([
        supabase.from("quote_trip_stops").select("*").eq("quote_trip_id", trip.id),
        supabase.from("quote_trip_vehicles").select("*").eq("quote_trip_id", trip.id),
        supabase.from("quote_trip_charges").select("*").eq("quote_trip_id", trip.id),
      ]);

    if (stops?.length) {
      await supabase.from("quote_trip_stops").insert(
        stops.map((s) => ({
          organization_id: orgId,
          quote_trip_id: newTrip.id,
          position: s.position,
          kind: s.kind,
          label: s.label,
          address: s.address,
          latitude: s.latitude,
          longitude: s.longitude,
          stop_date: s.stop_date,
          stop_time: s.stop_time,
          spot_time: s.spot_time,
          notes: s.notes,
          leg_miles: s.leg_miles,
          leg_minutes: s.leg_minutes,
        })),
      );
    }

    if (vehicles?.length) {
      await supabase.from("quote_trip_vehicles").insert(
        vehicles.map((v) => ({
          organization_id: orgId,
          quote_trip_id: newTrip.id,
          position: v.position,
          vehicle_type_id: v.vehicle_type_id,
          vehicle_id: v.vehicle_id,
          quantity: v.quantity,
        })),
      );
    }

    if (charges?.length) {
      await supabase.from("quote_trip_charges").insert(
        charges.map((c) => ({
          organization_id: orgId,
          quote_trip_id: newTrip.id,
          position: c.position,
          section: c.section,
          label: c.label,
          kind: c.kind,
          rate: c.rate,
          quantity: c.quantity,
          amount: c.amount,
          taxable: c.taxable,
        })),
      );
    }
  }

  revalidatePath("/quotes");
  redirect(`/quotes/${copy.id}`);
}

// ---------------------------------------------------------------------------
// Customer picker (Customer tab)
// ---------------------------------------------------------------------------

export type CustomerHit = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export async function searchCustomersForQuote(query: string): Promise<CustomerHit[]> {
  const { supabase } = await actionContext();
  const term = query.trim();

  let request = supabase
    .from("customers")
    .select("id, first_name, last_name, company, email, phone")
    .order("first_name")
    .limit(12);

  if (term) {
    const like = `%${term}%`;
    request = request.or(
      `first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
    );
  }

  const { data } = await request;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed",
    company: row.company,
    email: row.email,
    phone: row.phone,
  }));
}

export async function createCustomerForQuote(input: {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}): Promise<{ ok: true; customer: CustomerHit } | { ok: false; message: string }> {
  const { session, supabase } = await actionContext();

  const firstName = input.first_name?.trim();
  if (!firstName) return { ok: false, message: "A name is required." };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: session.organization.id,
      first_name: firstName,
      last_name: input.last_name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
    })
    .select("id, first_name, last_name, company, email, phone")
    .single();

  if (error || !data) {
    return { ok: false, message: databaseError(error!).message ?? "Could not add." };
  }

  revalidatePath("/customers");

  return {
    ok: true,
    customer: {
      id: data.id,
      name: [data.first_name, data.last_name].filter(Boolean).join(" "),
      company: data.company,
      email: data.email,
      phone: data.phone,
    },
  };
}

// ---------------------------------------------------------------------------
// Send / status
// ---------------------------------------------------------------------------

export async function sendQuoteFromBuilder(
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();
  if (!canWriteFinance(session.role)) {
    return { status: "error", message: "Your role does not allow sending quotes." };
  }

  const id = uuid.safeParse(formData.get("quote_id"));
  if (!id.success) return { status: "error", message: "That quote could not be found." };

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, expiry_days, expiry_anchor, first_sent_at")
    .eq("id", id.data)
    .maybeSingle();

  if (!quote) return { status: "error", message: "That quote could not be found." };

  const now = new Date();
  const firstSentAt = quote.first_sent_at ?? now.toISOString();

  let validUntil: string | null = null;
  if (quote.expiry_days) {
    const anchor =
      quote.expiry_anchor === "FIRST_SENT" ? new Date(firstSentAt) : now;
    anchor.setDate(anchor.getDate() + quote.expiry_days);
    validUntil = anchor.toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "SENT",
      pipeline_status: "QUOTED",
      sent_at: now.toISOString(),
      first_sent_at: firstSentAt,
      valid_until: validUntil,
    })
    .eq("id", quote.id);

  if (error) return databaseError(error);

  revalidateQuote(quote.id);
  return { status: "success", message: "Marked as sent. Share the customer link to deliver it." };
}
