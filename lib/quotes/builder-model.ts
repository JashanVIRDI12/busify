/**
 * The quote builder's client state *is* the save payload — one shape, so a save
 * is `saveQuoteBuilderAction(state)` with nothing to translate. This module maps
 * the loaded database rows into that shape.
 */

import type { QuoteBuilderData } from "@/lib/queries/quote-builder";
import type {
  QuoteBuilderInput,
  QuoteChargeInput,
  QuotePaymentMethodInput,
  QuoteStopInput,
  QuoteTripInput,
  QuoteVehicleInput,
} from "@/lib/validations/quote-builder";
import { defaultTaxRate, describeTaxRate } from "@/lib/tax/canada";
import type { PaymentMethodKind } from "@/types/database";

/** Postgres `time` comes back as "HH:MM:SS"; inputs want "HH:MM". */
function hm(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

const PAYMENT_METHOD_ORDER: PaymentMethodKind[] = [
  "CARD",
  "BANK",
  "CHECK",
  "WIRE",
  "OTHER",
];

export function toBuilderState(data: QuoteBuilderData): QuoteBuilderInput {
  const { quote } = data;

  const trips: QuoteTripInput[] = data.trips.map((trip) => ({
    id: trip.id,
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
    departing_time: hm(trip.departing_time),
    departing_arrival_time: hm(trip.departing_arrival_time),
    returning_garage_id: trip.returning_garage_id,
    returning_note: trip.returning_note,
    returning_date: trip.returning_date,
    returning_time: hm(trip.returning_time),
    return_leg_miles: Number(trip.return_leg_miles),
    return_leg_minutes: trip.return_leg_minutes,
    base_fare_mode: trip.base_fare_mode,
    base_fare_basis: trip.base_fare_basis,
    rate_daily: Number(trip.rate_daily),
    rate_hourly: Number(trip.rate_hourly),
    rate_per_mile: Number(trip.rate_per_mile),
    rate_flat_base: Number(trip.rate_flat_base),
    base_fare_override:
      trip.base_fare_override === null ? null : Number(trip.base_fare_override),
    days: Number(trip.days),
    hours: Number(trip.hours),
    total_miles: Number(trip.total_miles),
    dead_miles: Number(trip.dead_miles),
    live_miles: Number(trip.live_miles),
    estimated_minutes: trip.estimated_minutes,
    due_now_percent: Number(trip.due_now_percent),
    due_now_amount:
      trip.due_now_amount === null ? null : Number(trip.due_now_amount),
    balance_due_date: trip.balance_due_date,
    recurrence: trip.recurrence ?? null,
    notes: trip.notes,
    stops: [...trip.stops]
      .sort((a, b) => a.position - b.position)
      .map(
        (stop): QuoteStopInput => ({
          id: stop.id,
          position: stop.position,
          kind: stop.kind,
          label: stop.label,
          address: stop.address,
          latitude: stop.latitude === null ? null : Number(stop.latitude),
          longitude: stop.longitude === null ? null : Number(stop.longitude),
          stop_date: stop.stop_date,
          stop_time: hm(stop.stop_time),
          spot_time: hm(stop.spot_time),
          notes: stop.notes,
          leg_miles: Number(stop.leg_miles),
          leg_minutes: stop.leg_minutes,
          dwell_minutes: stop.dwell_minutes,
        }),
      ),
    vehicles:
      trip.vehicles.length > 0
        ? [...trip.vehicles]
            .sort((a, b) => a.position - b.position)
            .map(
              (vehicle): QuoteVehicleInput => ({
                id: vehicle.id,
                position: vehicle.position,
                vehicle_type_id: vehicle.vehicle_type_id,
                vehicle_id: vehicle.vehicle_id,
                quantity: vehicle.quantity,
              }),
            )
        : [newVehicle(0)],
    charges: [...trip.charges]
      .sort((a, b) => a.position - b.position)
      .map(
        (charge): QuoteChargeInput => ({
          id: charge.id,
          position: charge.position,
          section: charge.section,
          label: charge.label,
          kind: charge.kind,
          rate: Number(charge.rate),
          quantity: Number(charge.quantity),
          taxable: charge.taxable,
        }),
      ),
  }));

  const methodById = new Map(data.paymentMethods.map((m) => [m.method, m]));
  const paymentMethods: QuotePaymentMethodInput[] = PAYMENT_METHOD_ORDER.map(
    (method, index) => {
      const row = methodById.get(method);
      return {
        id: row?.id ?? crypto.randomUUID(),
        method,
        position: row?.position ?? index,
        enabled: row?.enabled ?? false,
        online_processing: row?.online_processing ?? false,
        processing_fee_percent: Number(row?.processing_fee_percent ?? 0),
        customer_note: row?.customer_note ?? null,
      };
    },
  );

  return {
    id: quote.id,
    header: {
      title: quote.title,
      pipeline_status: quote.pipeline_status,
      priority: quote.priority,
      sales_rep_id: quote.sales_rep_id,
      event_name: quote.event_name,
      referred_by: quote.referred_by,
      tags: quote.tags ?? [],
      customer_id: quote.customer_id,
      billing_customer_id: quote.billing_customer_id,
      customer_visibility: quote.customer_visibility,
      allow_instant_booking: quote.allow_instant_booking,
      allow_pay_later: quote.allow_pay_later,
      allow_full_card_payment: quote.allow_full_card_payment,
      po_number: quote.po_number,
      po_only: quote.po_only,
      payment_policy: quote.payment_policy,
      require_signature: quote.require_signature,
      expiry_days: quote.expiry_days,
      expiry_anchor: quote.expiry_anchor,
      contract_terms_id: quote.contract_terms_id,
      overage_basis: quote.overage_basis,
      overage_rate: quote.overage_rate === null ? null : Number(quote.overage_rate),
      notes: quote.notes,
    },
    trips,
    paymentMethods,
  };
}

/**
 * A quote that does not exist yet.
 *
 * "Add Quote" used to insert a row and redirect to it, which is why an
 * abandoned click left an empty Lead in the pipeline holding a quote number
 * nobody would ever use. The new-quote screen builds this instead and holds it
 * in memory; the first save is what creates the row, and the number is drawn
 * then. The id is generated here because every child upserts by id, so the
 * whole tree can be saved in one round trip once it does become real.
 */
export function blankQuoteState(options: {
  province: string | null;
  gstNumber: string | null;
  customerVisibility: QuoteBuilderInput["header"]["customer_visibility"];
  contractTermsId: string | null;
  defaultGarageId: string | null;
  enableSalesTax: boolean;
  standingCharges?: {
    name: string;
    rate_type: "FLAT" | "PER_QUANTITY" | "PERCENTAGE";
    rate: number;
    tax_exempt: boolean;
  }[];
}): QuoteBuilderInput {
  const trip = newTrip(0, options.province, options.gstNumber);

  trip.departing_garage_id = options.defaultGarageId;
  trip.returning_garage_id = options.defaultGarageId;

  // Sales tax is a setting: an operator who is not registered should not have
  // to delete the line off every quote they build.
  if (!options.enableSalesTax) {
    trip.charges = trip.charges.filter((charge) => charge.section !== "TAX");
  }

  // Charges an operator marked "add to every new quote", after the tax row so
  // the seeded itemised charges keep their configured order.
  for (const [index, charge] of (options.standingCharges ?? []).entries()) {
    trip.charges.push({
      id: crypto.randomUUID(),
      position: trip.charges.length + index,
      section: "ITEMIZED",
      label: charge.name,
      kind: charge.rate_type === "PERCENTAGE" ? "PERCENT" : "FLAT",
      // A percentage row's amount is computed by the pricing engine from the
      // subtotal, so it carries only its rate here.
      rate: charge.rate,
      quantity: 1,
      taxable: !charge.tax_exempt,
    });
  }

  return {
    id: crypto.randomUUID(),
    header: {
      title: "New Quote",
      pipeline_status: "LEAD",
      priority: null,
      sales_rep_id: null,
      event_name: null,
      referred_by: null,
      tags: [],
      customer_id: null,
      billing_customer_id: null,
      customer_visibility: options.customerVisibility,
      allow_instant_booking: true,
      allow_pay_later: false,
      allow_full_card_payment: true,
      po_number: null,
      po_only: false,
      payment_policy: null,
      require_signature: false,
      expiry_days: null,
      expiry_anchor: "LAST_SENT",
      contract_terms_id: options.contractTermsId,
      overage_basis: null,
      overage_rate: null,
      notes: null,
    },
    trips: [trip],
    paymentMethods: PAYMENT_METHOD_ORDER.map((method, index) => ({
      id: crypto.randomUUID(),
      method,
      position: index,
      enabled: method === "CARD" || method === "BANK" || method === "CHECK",
      online_processing: method === "CARD" || method === "BANK",
      processing_fee_percent: 0,
      customer_note: null,
    })),
  };
}

/** A stable string that changes whenever any savable field changes. */
export function builderFingerprint(state: QuoteBuilderInput): string {
  return JSON.stringify(state);
}

export function newStop(position: number, kind: QuoteStopInput["kind"]): QuoteStopInput {
  return {
    id: crypto.randomUUID(),
    position,
    kind,
    label: kind === "PICKUP" ? "Pickup" : kind === "DROPOFF" ? "Dropoff" : null,
    address: null,
    latitude: null,
    longitude: null,
    stop_date: null,
    stop_time: null,
    spot_time: null,
    notes: null,
    leg_miles: 0,
    leg_minutes: 0,
    dwell_minutes: 0,
  };
}

export function newVehicle(position: number): QuoteVehicleInput {
  return {
    id: crypto.randomUUID(),
    position,
    vehicle_type_id: null,
    vehicle_id: null,
    quantity: 1,
  };
}

/**
 * A charge the operator keeps in Settings, ready to drop onto a quote.
 *
 * Copied onto the trip rather than referenced, on purpose: raising the fuel
 * surcharge next spring must not silently reprice a quote sent last autumn.
 */
export type ChargePreset = {
  label: string;
  kind: QuoteChargeInput["kind"];
  rate: number;
  taxable: boolean;
};

export function newCharge(
  section: QuoteChargeInput["section"],
  position: number,
  preset?: ChargePreset,
): QuoteChargeInput {
  return {
    id: crypto.randomUUID(),
    position,
    section,
    label: preset?.label ?? "",
    kind: preset?.kind ?? (section === "TAX" ? "PERCENT" : "FLAT"),
    rate: preset?.rate ?? 0,
    quantity: 1,
    taxable: preset?.taxable ?? true,
  };
}

/** The seed tax row for a fresh trip, from the place of supply. */
export function seedTaxCharge(
  province: string | null,
  gstNumber: string | null,
): QuoteChargeInput {
  const rate = defaultTaxRate(province);
  const label = gstNumber
    ? `${describeTaxRate(rate, province)}# ${gstNumber}`
    : describeTaxRate(rate, province);
  return {
    id: crypto.randomUUID(),
    position: 0,
    section: "TAX",
    label,
    kind: "PERCENT",
    rate,
    quantity: 1,
    taxable: false,
  };
}

export function newTrip(
  position: number,
  province: string | null,
  gstNumber: string | null,
): QuoteTripInput {
  return {
    id: crypto.randomUUID(),
    position,
    name: `Trip ${position + 1}`,
    trip_type: null,
    passenger_count: null,
    driver_count: null,
    trip_contact_name: null,
    trip_contact_email: null,
    trip_contact_phone: null,
    departing_garage_id: null,
    departing_note: null,
    departing_date: null,
    departing_time: null,
    departing_arrival_time: null,
    returning_garage_id: null,
    returning_note: null,
    returning_date: null,
    returning_time: null,
    return_leg_miles: 0,
    return_leg_minutes: 0,
    base_fare_mode: "HIGHEST",
    base_fare_basis: null,
    rate_daily: 0,
    rate_hourly: 0,
    rate_per_mile: 0,
    rate_flat_base: 0,
    base_fare_override: null,
    days: 0,
    hours: 0,
    total_miles: 0,
    dead_miles: 0,
    live_miles: 0,
    estimated_minutes: 0,
    due_now_percent: 0,
    due_now_amount: null,
    balance_due_date: null,
    recurrence: null,
    notes: null,
    stops: [newStop(0, "PICKUP"), newStop(1, "DROPOFF")],
    vehicles: [newVehicle(0)],
    charges: [seedTaxCharge(province, gstNumber)],
  };
}
