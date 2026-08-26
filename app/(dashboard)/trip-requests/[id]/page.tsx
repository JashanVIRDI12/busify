import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  TripRequestStatusBadge,
  TripStatusBadge,
} from "@/components/shared/status-badge";
import { TripCopilot } from "@/components/ai/trip-copilot";
import { QuoteBuilderDialog } from "@/components/quotes/quote-builder-dialog";
import { FleetAvailabilityPanel } from "@/components/trip-requests/fleet-availability-panel";
import { RequestActions } from "@/components/trip-requests/request-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { canWrite, canWriteFinance } from "@/lib/permissions";
import { COPILOT_SUGGESTIONS } from "@/lib/ai/prompts";
import { aiConfigured } from "@/lib/ai/client";
import { getFleetAvailability } from "@/lib/queries/availability";
import { getTripRequest } from "@/lib/queries/trip-requests";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getTripRequest(id);
  return {
    title: result?.request.reference
      ? `Request ${result.request.reference}`
      : "Trip request",
  };
}

const SOURCE_LABELS: Record<string, string> = {
  DASHBOARD: "Logged in dashboard",
  WEBSITE_WIDGET: "Website widget",
  HOSTED_PAGE: "Hosted booking page",
  API: "API",
  AI: "AI intake",
};

export default async function TripRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role, organization } = await requireSession();

  const result = await getTripRequest(id);
  if (!result) notFound();

  const { request, customer } = result;
  const timeZone = organization.timezone;

  const supabase = await createClient();

  const [availability, { data: trip }, { data: quotes }, { data: vehicleTypes }, { data: customers }] =
    await Promise.all([
      getFleetAvailability(request),
      supabase
        .from("trips")
        .select("id, status")
        .eq("trip_request_id", request.id)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select("id, quote_number, status, total, currency")
        .eq("trip_request_id", request.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_types")
        .select("id, name, base_rate, per_km_rate, per_hour_rate, default_capacity")
        .order("name"),
      supabase
        .from("customers")
        .select("id, first_name, last_name, company")
        .order("first_name"),
    ]);

  const requirements = (request.special_requirements ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const contactName =
    customer
      ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
      : request.contact_name;
  const contactEmail = customer?.email ?? request.contact_email;
  const contactPhone = customer?.phone ?? request.contact_phone;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/trip-requests">
          <ArrowLeft />
          Back to trip requests
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Trip request ${request.reference ?? ""}`}
        title={`${request.pickup_location} → ${request.destination}`}
        description={
          SOURCE_LABELS[request.source] ??
          "Received through an unrecognized channel"
        }
        actions={<TripRequestStatusBadge status={request.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>The journey</CardTitle>
                <CardDescription>
                  All times in {timeZone.replace(/_/g, " ")}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Pickup
                    </p>
                    <p className="text-sm font-medium">{request.pickup_location}</p>
                    {request.pickup_address && (
                      <p className="text-sm text-muted-foreground text-pretty">
                        {request.pickup_address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Destination
                    </p>
                    <p className="text-sm font-medium">{request.destination}</p>
                    {request.destination_address && (
                      <p className="text-sm text-muted-foreground text-pretty">
                        {request.destination_address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Departure
                    </p>
                    <p className="tabular text-sm font-medium">
                      {formatDateTime(request.departure_at, timeZone)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {relativeDays(request.departure_at)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Return
                    </p>
                    <p className="tabular text-sm font-medium">
                      {request.return_at
                        ? formatDateTime(request.return_at, timeZone)
                        : "One way"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="tabular text-sm">
                  <span className="font-semibold">
                    {formatNumber(request.passenger_count)}
                  </span>{" "}
                  passengers
                </p>
              </div>

              {requirements.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Special requirements
                  </p>
                  <ul className="space-y-1.5">
                    {requirements.map((line) => (
                      <li key={line} className="flex gap-2 text-sm">
                        <span aria-hidden className="text-muted-foreground">
                          •
                        </span>
                        <span className="text-pretty">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <FleetAvailabilityPanel
            availability={availability}
            passengerCount={request.passenger_count}
          />

          {aiConfigured() && (
            <TripCopilot
              tripRequestId={request.id}
              suggestions={COPILOT_SUGGESTIONS}
            />
          )}

          {request.notes && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Activity</CardTitle>
                  <CardDescription>
                    Questions asked and decisions taken on this request.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="font-sans text-sm whitespace-pre-wrap text-muted-foreground">
                  {request.notes}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Customer</CardTitle>
                {!customer && (
                  <CardDescription>
                    Not linked to a customer record yet.
                  </CardDescription>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{contactName ?? "Unknown"}</p>
              {customer?.company && (
                <p className="text-sm text-muted-foreground">{customer.company}</p>
              )}
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center gap-2 text-sm text-interactive hover:underline"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  {contactEmail}
                </a>
              )}
              {contactPhone && (
                <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {contactPhone}
                </p>
              )}
              {customer && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/customers">View in customers</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Actions</CardTitle>
                <CardDescription>
                  A request never becomes a booking on its own.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {trip && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
                  <ClipboardList
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Trip scheduled</p>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="text-xs text-interactive hover:underline"
                    >
                      Open the trip
                    </Link>
                  </div>
                  <TripStatusBadge status={trip.status} />
                </div>
              )}

              {(quotes ?? []).length > 0 && (
                <div className="mb-4 space-y-2">
                  {(quotes ?? []).map((quote) => (
                    <Link
                      key={quote.id}
                      href={`/quotes/${quote.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <FileText
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="tabular text-sm font-medium">
                          {quote.quote_number}
                        </p>
                        <p className="tabular text-xs text-muted-foreground">
                          {formatMoney(Number(quote.total), quote.currency)}
                        </p>
                      </div>
                      <Badge variant="secondary">{quote.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}

              {canWriteFinance(role) && request.status !== "DECLINED" && (
                <QuoteBuilderDialog
                  vehicleTypes={vehicleTypes ?? []}
                  customers={customers ?? []}
                  currency={organization.currency}
              province={organization.state}
                  tripRequestId={request.id}
                  defaultCustomerId={request.customer_id}
                  trigger={
                    <Button variant="outline" size="lg" className="mb-3 w-full">
                      <FileText />
                      Create quote
                    </Button>
                  }
                />
              )}

              <RequestActions
                requestId={request.id}
                status={request.status}
                canAct={canWrite(role)}
                meetsDemand={availability.meetsDemand}
                tripId={trip?.id ?? null}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
