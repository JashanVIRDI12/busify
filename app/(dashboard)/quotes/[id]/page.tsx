import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Inbox, Mail, Phone } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { QuoteSummary } from "@/components/quotes/quote-summary";
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
import { formatDate, formatDateTime } from "@/lib/datetime";
import { siteUrl } from "@/lib/env";
import { canWriteFinance } from "@/lib/permissions";
import { getQuote } from "@/lib/queries/quotes";
import { formatNumber } from "@/lib/utils";
import type { QuoteStatus } from "@/types/database";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

const STATUS_TONE: Record<
  QuoteStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "muted"
> = {
  DRAFT: "muted",
  SENT: "default",
  VIEWED: "warning",
  ACCEPTED: "success",
  DECLINED: "destructive",
  EXPIRED: "muted",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getQuote(id);
  return { title: detail?.quote.quote_number ?? "Quote" };
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role, organization } = await requireSession();

  const detail = await getQuote(id);
  if (!detail) notFound();

  const { quote, items, customer, request } = detail;
  const timeZone = organization.timezone;
  const publicUrl = `${siteUrl()}/quote/${quote.public_token}`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/quotes">
          <ArrowLeft />
          Back to quotes
        </Link>
      </Button>

      <PageHeader
        eyebrow="Quote"
        title={quote.quote_number ?? "Quote"}
        description={
          customer
            ? `For ${[customer.first_name, customer.last_name].filter(Boolean).join(" ")}`
            : "No customer linked yet."
        }
        actions={
          <Badge variant={STATUS_TONE[quote.status]}>
            {STATUS_LABELS[quote.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          {request && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    {request.pickup_location} → {request.destination}
                  </CardTitle>
                  <CardDescription>
                    {formatDateTime(request.departure_at, timeZone)}
                    {request.return_at
                      ? ` — ${formatDateTime(request.return_at, timeZone)}`
                      : " · one way"}{" "}
                    · {formatNumber(request.passenger_count)} passengers
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/trip-requests/${request.id}`}>
                    <Inbox />
                    {request.reference ?? "Request"}
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Priced breakdown</CardTitle>
                <CardDescription>
                  Calculated by the pricing engine from your vehicle type rates.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <QuoteSummary
                items={items}
                totals={quote}
                gstNumber={organization.gst_hst_number}
              />
            </CardContent>
          </Card>

          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {quote.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <>
                  <p className="text-sm font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  {customer.company && (
                    <p className="text-sm text-muted-foreground">{customer.company}</p>
                  )}
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-2 text-sm text-interactive hover:underline"
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="size-3.5 shrink-0" aria-hidden />
                      {customer.phone}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not linked to a customer record.
                </p>
              )}

              {quote.valid_until && (
                <p className="tabular border-t border-border pt-3 text-sm text-muted-foreground">
                  Valid until{" "}
                  {formatDate(`${quote.valid_until}T00:00:00Z`, timeZone)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteActions
                quoteId={quote.id}
                status={quote.status}
                publicUrl={publicUrl}
                canEdit={canWriteFinance(role)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
