import Link from "next/link";
import { FileText } from "lucide-react";

import { StatusPill } from "@/components/data/status-pill";
import { Button } from "@/components/ui/button";
import { formatStamp } from "@/lib/datetime";
import { cn, formatMoney } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Trip = Tables<"trips">;

const PAYMENT = {
  UNPAID: { label: "Unpaid", tone: "orange" },
  PARTIAL: { label: "Part paid", tone: "violet" },
  PAID: { label: "Paid", tone: "teal" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
} as const;

/**
 * The commercial and operational facts of a reservation, above the itinerary.
 *
 * These live together because they are read together: a dispatcher opening a
 * job wants to know what time the coach leaves the yard, and whether the
 * customer has paid, before they read a single stop.
 */
export function ReservationSummary({
  trip,
  currency,
  timeZone,
  canInvoice,
}: {
  trip: Trip;
  currency: string;
  timeZone: string;
  canInvoice: boolean;
}) {
  const payment = PAYMENT[trip.payment_status];
  const balance = Number(trip.balance_due);

  const clock = [
    { label: "Garage arrival", at: trip.garage_arrival_at },
    { label: "Spot", at: trip.spot_at },
    { label: "Departure", at: trip.departure_at },
    { label: "Drop-off", at: trip.dropoff_at },
    { label: "Return", at: trip.return_at },
  ].filter((entry) => entry.at);

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] text-slate">Reservation</p>
          <p className="tabular text-heading-sm font-semibold text-ink">
            {trip.reference ?? "Unnumbered"}
          </p>
          {trip.group_name && (
            <p className="mt-0.5 text-body-sm text-carbon">{trip.group_name}</p>
          )}
        </div>

        {canInvoice && Number(trip.total_due) > 0 && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/reservations/${trip.id}/invoice`}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="size-3.5" />
              Invoice PDF
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4 border-t border-bone pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Invoiced" value={formatMoney(trip.total_due, currency, { precise: true })} />
        <Fact label="Collected" value={formatMoney(trip.amount_paid, currency, { precise: true })} />
        <Fact
          label="Balance"
          value={formatMoney(balance, currency, { precise: true })}
          emphasis={balance > 0}
        />
        <div>
          <p className="text-[12px] text-slate">Payment</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill label={payment.label} tone={payment.tone} />
            <span className="text-[11.5px] text-ash">
              {trip.invoice_sent_at
                ? `Invoiced ${formatStamp(trip.invoice_sent_at, timeZone, { shortYear: true, withZone: false })}`
                : "Not invoiced"}
            </span>
          </p>
        </div>
      </div>

      {clock.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-bone pt-4">
          {clock.map((entry) => (
            <div key={entry.label}>
              <p className="text-[12px] text-slate">{entry.label}</p>
              <p className="tabular mt-0.5 text-body-sm text-ink">
                {formatStamp(entry.at!, timeZone)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-[12px] text-slate">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-subheading font-semibold",
          emphasis ? "text-orange-600" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
