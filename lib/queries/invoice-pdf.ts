import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatStamp, formatStampDate } from "@/lib/datetime";
import type { QuotePdfData } from "@/lib/pdf/quote-pdf";
import { formatMoney } from "@/lib/utils";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * The invoice for one reservation.
 *
 * Reuses the quote document rather than introducing a second layout: a charter
 * invoice *is* the itinerary plus what is owed, and an operator sending both
 * from the same letterhead is the point. Only the totals block differs — an
 * invoice reports what has been collected, where a quote reports what is due.
 */
export async function getInvoicePdfData(
  supabase: Client,
  tripId: string,
): Promise<QuotePdfData | null> {
  const { data: trip } = await supabase
    .from("trips")
    .select(
      `*,
       companies(name),
       customers(first_name, last_name, email, phone, company),
       garages(name)`,
    )
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", trip.organization_id)
    .maybeSingle();

  if (!organization) return null;

  const zone = organization.timezone;
  const currency = organization.currency;
  const money = (value: number | string) =>
    formatMoney(Number(value), currency, { precise: true });

  const total = Number(trip.total_due);
  const paid = Number(trip.amount_paid);
  const balance = Number(trip.balance_due);

  return {
    organization: {
      name: organization.name,
      addressLines: [
        organization.address,
        organization.address_line2,
        [organization.city, organization.state, organization.postal_code]
          .filter(Boolean)
          .join(" "),
      ].filter((line): line is string => Boolean(line && line.trim())),
      email: organization.email,
      phone: organization.operations_phone ?? organization.phone,
      taxNumber: organization.gst_hst_number
        ? `GST/HST ${organization.gst_hst_number}`
        : null,
      brandColor: organization.brand_primary_color,
      logo: await fetchLogo(organization.logo_url),
    },
    quote: {
      kind: "Invoice",
      reference: trip.reference ?? "Invoice",
      title: trip.group_name ?? "",
      createdOn: formatStampDate(trip.created_at, zone),
      validUntil: null,
      notes: trip.notes,
      terms: null,
    },
    contact: {
      name: trip.customers
        ? [trip.customers.first_name, trip.customers.last_name]
            .filter(Boolean)
            .join(" ")
        : null,
      company: trip.companies?.name ?? trip.customers?.company ?? null,
      email: trip.customers?.email ?? null,
      phone: trip.customers?.phone ?? null,
    },
    trips: [
      {
        name: trip.group_name ?? "Charter",
        stops: [
          {
            label: trip.pickup_location,
            address: trip.garages?.name ? `From ${trip.garages.name}` : null,
            when: formatStamp(trip.departure_at, zone),
          },
          {
            label: trip.destination,
            address: null,
            when: trip.dropoff_at ? formatStamp(trip.dropoff_at, zone) : null,
          },
          ...(trip.return_at
            ? [
                {
                  label: "Return",
                  address: null,
                  when: formatStamp(trip.return_at, zone),
                },
              ]
            : []),
        ],
        lines: [
          {
            label: `Charter — ${trip.passenger_count} passenger${
              trip.passenger_count === 1 ? "" : "s"
            }`,
            detail: null,
            amount: money(total),
          },
        ],
        total: money(total),
      },
    ],
    totals: [
      { label: "Total", amount: money(total), strong: true },
      ...(paid > 0 ? [{ label: "Paid", amount: money(paid) }] : []),
      {
        label: balance > 0 ? "Balance due" : "Paid in full",
        amount: money(Math.max(balance, 0)),
        strong: balance > 0,
      },
    ],
  };
}

/** Same tolerance as the quote document: a bad logo never blocks an invoice. */
async function fetchLogo(
  url: string | null,
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    const type = contentType.includes("png")
      ? "png"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : null;

    if (!type) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > 0 ? { bytes, type } : null;
  } catch {
    return null;
  }
}
