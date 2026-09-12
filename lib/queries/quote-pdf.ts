import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatStampDate, formatStampTime } from "@/lib/datetime";
import type { QuotePdfData, QuotePdfTrip } from "@/lib/pdf/quote-pdf";
import { formatMoney } from "@/lib/utils";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Assemble everything the quote PDF prints, in one place.
 *
 * Takes a client rather than creating one, because the same document is
 * produced for the operator (their session) and for the customer's public page
 * (service role, resolved by token). The queries are identical; only who is
 * asking differs.
 */
export async function getQuotePdfData(
  supabase: Client,
  quoteId: string,
): Promise<QuotePdfData | null> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) return null;

  const [
    { data: organization },
    { data: contact },
    { data: trips },
    { data: terms },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", quote.organization_id)
      .maybeSingle(),
    quote.customer_id
      ? supabase
          .from("customers")
          .select("first_name, last_name, email, phone, company, companies(name)")
          .eq("id", quote.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("quote_trips")
      .select(
        `id, position, name, total,
         quote_trip_stops(position, label, address, stop_date, stop_time),
         quote_trip_charges(position, section, label, amount, kind, rate, quantity)`,
      )
      .eq("quote_id", quoteId)
      .order("position", { ascending: true }),
    quote.contract_terms_id
      ? supabase
          .from("contract_terms")
          .select("body")
          .eq("id", quote.contract_terms_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!organization) return null;

  const zone = organization.timezone;
  const currency = quote.currency;
  const money = (value: number | string) =>
    formatMoney(Number(value), currency, { precise: true });

  const pdfTrips: QuotePdfTrip[] = (trips ?? []).map((trip) => {
    const stops = [...(trip.quote_trip_stops ?? [])].sort(
      (a, b) => a.position - b.position,
    );

    const charges = [...(trip.quote_trip_charges ?? [])]
      // The base fare is already inside the trip total, and taxes are shown in
      // the summary — the customer wants the itemised extras named here.
      .filter((charge) => charge.section === "ITEMIZED")
      .sort((a, b) => a.position - b.position);

    return {
      name: trip.name,
      stops: stops.map((stop) => ({
        label: stop.label ?? "",
        address: stop.address,
        when: stop.stop_date
          ? [
              formatStampDate(`${stop.stop_date}T12:00:00Z`, "UTC"),
              stop.stop_time
                ? formatStampTime(
                    `${stop.stop_date}T${stop.stop_time.slice(0, 5)}:00`,
                    zone,
                  )
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : null,
      })),
      lines: charges.map((charge) => ({
        label: charge.label || "Charge",
        detail:
          charge.kind === "PERCENT"
            ? `${Number(charge.rate)}%`
            : Number(charge.quantity) > 1
              ? `${Number(charge.quantity)} × ${money(charge.rate)}`
              : null,
        amount: money(charge.amount),
      })),
      total: money(trip.total),
    };
  });

  const totals = [
    { label: "Subtotal", amount: money(quote.subtotal) },
    ...(Number(quote.tax) > 0
      ? [{ label: "Tax", amount: money(quote.tax) }]
      : []),
    { label: "Total", amount: money(quote.total), strong: true },
    ...(Number(quote.deposit_amount) > 0
      ? [
          { label: "Due now", amount: money(quote.deposit_amount) },
          {
            label: "Balance",
            amount: money(Number(quote.total) - Number(quote.deposit_amount)),
          },
        ]
      : []),
  ];

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
      phone: organization.sales_phone ?? organization.phone,
      taxNumber: organization.gst_hst_number
        ? `GST/HST ${organization.gst_hst_number}`
        : null,
      brandColor: organization.brand_primary_color,
      logo: await fetchLogo(organization.logo_url),
    },
    quote: {
      kind: "Quote",
      reference: quote.reference ?? quote.quote_number ?? "Quote",
      title: quote.title,
      createdOn: formatStampDate(quote.created_at, zone),
      validUntil: quote.valid_until
        ? formatStampDate(`${quote.valid_until}T12:00:00Z`, "UTC")
        : null,
      notes: quote.notes,
      terms: terms?.body ?? null,
    },
    contact: {
      name: contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        : null,
      company: contact?.companies?.name ?? contact?.company ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    trips: pdfTrips,
    totals,
  };
}

/**
 * The logo, if there is one and it downloads promptly.
 *
 * Bounded and failure-tolerant on purpose: a slow or broken image URL must
 * never be the reason a customer cannot get their quote.
 */
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

    // pdf-lib embeds PNG and JPEG only; an SVG logo is skipped rather than
    // crashing the document.
    if (!type) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > 0 ? { bytes, type } : null;
  } catch {
    return null;
  }
}
