import Link from "next/link";
import { FileText } from "lucide-react";

import { StatusPill } from "@/components/data/status-pill";
import {
  ReservationCrew,
  type ReservationCrewRow,
} from "@/components/reservations/reservation-crew";
import { Button } from "@/components/ui/button";
import {
  formatDayLabel,
  formatSpan,
  formatStamp,
  formatStampTime,
  minutesBetween,
} from "@/lib/datetime";
import { cn, formatMoney } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Trip = Tables<"trips">;

const PAYMENT = {
  UNPAID: { label: "Unpaid", tone: "orange" },
  PARTIAL: { label: "Part paid", tone: "violet" },
  PAID: { label: "Paid", tone: "teal" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
} as const;

type Milestone = { label: string; at: string; yard: boolean };

/**
 * The commercial and operational facts of a reservation, above the itinerary.
 *
 * These live together because they are read together: a dispatcher opening a
 * job wants to know when the coach leaves the yard, and whether the customer
 * has paid, before they read a single stop. The run leads, because it is read
 * on every visit; the money sits beside it, because it is read on some.
 */
export function ReservationSummary({
  trip,
  crew,
  currency,
  timeZone,
  canInvoice,
}: {
  trip: Trip;
  /** Who is on the job, one entry per assignment row; empty reads as a gap. */
  crew: { rows: ReservationCrewRow[]; canEdit: boolean };
  currency: string;
  timeZone: string;
  canInvoice: boolean;
}) {
  const payment = PAYMENT[trip.payment_status];
  const total = Number(trip.total_due);
  const collected = Number(trip.amount_paid);
  const balance = Number(trip.balance_due);
  const share = total > 0 ? Math.min(1, Math.max(0, collected / total)) : 0;
  const money = (value: number) => formatMoney(value, currency, { precise: true });

  // The day as the driver lives it. The yard ends are the operator's own
  // movements and are drawn hollow; the middle three are the customer's.
  const milestones = (
    [
      { label: "Leaves yard", at: trip.garage_arrival_at, yard: true },
      { label: "Spot", at: trip.spot_at, yard: false },
      { label: "Departs", at: trip.departure_at, yard: false },
      { label: "Last drop-off", at: trip.dropoff_at, yard: false },
      { label: "Back in yard", at: trip.return_at, yard: true },
    ] as { label: string; at: string | null; yard: boolean }[]
  ).filter((entry): entry is Milestone => Boolean(entry.at));

  const first = milestones[0]?.at ?? null;
  const last = milestones.at(-1)?.at ?? null;
  const firstDay = formatDayLabel(first, timeZone);
  const lastDay = formatDayLabel(last, timeZone);
  const span = first && last ? minutesBetween(first, last) : 0;

  return (
    <section className="panel grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-body-sm font-semibold text-ink">The run</h2>
          {first && (
            <p className="tabular text-[12px] text-slate">
              {firstDay}
              {lastDay !== firstDay && ` – ${lastDay}`}
              {span > 0 && ` · ${formatSpan(span)} yard to yard`}
            </p>
          )}
        </div>

        {milestones.length > 0 ? (
          <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-0">
            {milestones.map((entry, index) => {
              const day = formatDayLabel(entry.at, timeZone);
              const dayChanged = day !== formatDayLabel(milestones[index - 1]?.at ?? first, timeZone);

              return (
                <li key={entry.label} className="min-w-0">
                  <div className="flex items-center" aria-hidden="true">
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        entry.yard
                          ? "border-2 border-fog bg-signal-white"
                          : "bg-teal-500",
                      )}
                    />
                    {index < milestones.length - 1 && (
                      <span className="mx-2 hidden h-px flex-1 bg-cloud lg:block" />
                    )}
                  </div>
                  <p className="mt-2 text-[12px] text-slate">{entry.label}</p>
                  <p className="tabular text-body font-semibold whitespace-nowrap text-ink">
                    {formatStampTime(entry.at, timeZone)}
                  </p>
                  {dayChanged && (
                    <p className="tabular text-[11px] text-slate">{day}</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-body-sm text-slate">
            No times yet. They come across from the quote&apos;s itinerary when
            it is converted.
          </p>
        )}

        {/* The next question after "when" is "who". Level with the invoice row
            opposite, so both halves of the card end on the same line. */}
        <div className="mt-5 flex min-h-11 flex-col justify-center border-t border-bone pt-3 lg:mt-auto">
          <ReservationCrew tripId={trip.id} rows={crew.rows} canEdit={crew.canEdit} />
        </div>
      </div>

      <div className="border-t border-bone p-5 sm:p-6 lg:border-t-0 lg:border-l">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-body-sm font-semibold text-ink">Payment</h2>
          <StatusPill label={payment.label} tone={payment.tone} />
        </div>

        {total > 0 ? (
          <>
            <p className="mt-3 text-[12px] text-slate">
              {balance > 0 ? "Balance due" : "Balance"}
            </p>
            <p
              className={cn(
                "tabular text-subheading font-semibold",
                balance > 0 ? "text-orange-600" : "text-teal-600",
              )}
            >
              {balance > 0 ? money(balance) : "Paid in full"}
            </p>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bone" aria-hidden="true">
              <div
                className="h-full rounded-full bg-teal-500"
                style={{ width: `${share * 100}%` }}
              />
            </div>
            <p className="tabular mt-2 text-[12px] text-slate">
              {money(collected)} of {money(total)} collected
            </p>
          </>
        ) : (
          <p className="mt-3 text-body-sm text-slate">No charges on this reservation yet.</p>
        )}

        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-bone pt-3">
          <span className="text-[12px] text-slate">
            {trip.invoice_sent_at
              ? `Invoiced ${formatStamp(trip.invoice_sent_at, timeZone, { shortYear: true, withZone: false })}`
              : "Not invoiced yet"}
          </span>
          {canInvoice && total > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/reservations/${trip.id}/invoice`} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" aria-hidden="true" />
                Invoice PDF
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
