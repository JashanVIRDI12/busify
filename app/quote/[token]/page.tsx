import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Users, XCircle } from "lucide-react";

import { markQuoteViewed } from "@/app/quote/[token]/actions";
import { QuoteResponseForm } from "@/components/quotes/quote-response-form";
import { QuoteSummary } from "@/components/quotes/quote-summary";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { getPublicQuote } from "@/lib/queries/quotes";
import { formatMoney, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your transportation quote",
  // A priced quote has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicQuote(token);
  if (!data) notFound();

  const { quote, items, organization, customerName, trip, expired } = data;

  // Record the open. Never allowed to block the render.
  await markQuoteViewed(token).catch(() => {});

  const settled = quote.status === "ACCEPTED" || quote.status === "DECLINED";
  const depositLabel = formatMoney(Number(quote.deposit_amount), quote.currency);

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className=" pointer-events-none absolute inset-x-0 top-0 h-72"
      />

      <main className="relative mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
        <header className="text-center">
          <p className="text-xs font-medium tracking-wide text-interactive uppercase">
            {organization.name}
          </p>
          <h1 className="mt-3 font-display text-3xl font-normal tracking-tight text-balance sm:text-4xl">
            Your transportation quote
          </h1>
          {customerName && (
            <p className="mt-3 text-sm text-muted-foreground">
              Prepared for {customerName}
            </p>
          )}
          <p className="tabular mt-1 text-xs text-muted-foreground">
            {quote.quote_number}
          </p>
        </header>

        {trip && (
          <section className="mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight text-balance">
              {trip.pickup_location} → {trip.destination}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="tabular inline-flex items-center gap-2">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {formatDateTime(trip.departure_at, organization.timezone)}
                {trip.return_at
                  ? ` — ${formatDateTime(trip.return_at, organization.timezone)}`
                  : ""}
              </span>
              <span className="tabular inline-flex items-center gap-2">
                <Users className="size-4 shrink-0" aria-hidden />
                {formatNumber(trip.passenger_count)} passengers
              </span>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <QuoteSummary
            items={items}
            totals={quote}
            gstNumber={organization.gst_hst_number}
          />
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-(--shadow-subtle) sm:p-8">
          {settled ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span
                className={
                  quote.status === "ACCEPTED"
                    ? "flex size-12 items-center justify-center rounded-xl bg-success/12 text-success"
                    : "flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                }
              >
                {quote.status === "ACCEPTED" ? (
                  <CheckCircle2 className="size-6" aria-hidden />
                ) : (
                  <XCircle className="size-6" aria-hidden />
                )}
              </span>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  {quote.status === "ACCEPTED"
                    ? "You accepted this quote"
                    : "You declined this quote"}
                </h2>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
                  {quote.status === "ACCEPTED"
                    ? `${organization.name} has your booking. Contact them if anything needs to change.`
                    : `Contact ${organization.name} if you would like a revised price.`}
                </p>
              </div>
            </div>
          ) : expired ? (
            <div className="py-4 text-center">
              <h2 className="text-lg font-semibold tracking-tight">
                This quote has expired
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
                It was valid until{" "}
                {formatDate(`${quote.valid_until}T00:00:00Z`, organization.timezone)}.
                Contact {organization.name} and they can reissue it.
              </p>
            </div>
          ) : (
            <QuoteResponseForm
              token={quote.public_token}
              companyName={organization.name}
              depositLabel={depositLabel}
            />
          )}
        </section>

        {quote.notes && (
          <p className="mt-6 text-center text-sm whitespace-pre-wrap text-muted-foreground">
            {quote.notes}
          </p>
        )}

        <footer className="mt-10 space-y-1 text-center text-xs text-muted-foreground">
          {(organization.phone || organization.email) && (
            <p>
              Questions? Contact {organization.name}
              {organization.phone ? ` on ${organization.phone}` : ""}
              {organization.email ? ` or ${organization.email}` : ""}.
            </p>
          )}
          <p>VIABUS</p>
        </footer>
      </main>
    </div>
  );
}
