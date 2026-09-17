import Link from "next/link";
import { Hammer, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import type { DriverPayLine } from "@/lib/queries/reservation-tabs";
import type { Trip } from "@/lib/queries/trips";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import type { Tables } from "@/types/database";

/**
 * The reservation's secondary panels.
 *
 * Server components, so each one reads its data straight from what the page
 * already loaded. They share an empty state on purpose: a panel with nothing in
 * it should say what would put something there, not just sit blank.
 */

function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-cloud bg-mist/40 px-6 py-10 text-center">
      <p className="text-body-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-[46ch] text-body-sm text-slate">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-bone bg-signal-white px-3 py-1.5 text-body-sm font-semibold text-ink transition-colors hover:bg-mist"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {action.label}
        </Link>
      )}
    </div>
  );
}

const PAYMENT_TONE: Record<string, string> = {
  PAID: "bg-teal-100 text-teal-700",
  PARTIAL: "bg-amber/18 text-[#8a4b12]",
  UNPAID: "bg-plaster text-slate",
  REFUNDED: "bg-destructive/10 text-destructive",
};

/** What the job is worth, what has come in, and what the charges were. */
export function PaymentsPanel({
  trip,
  items,
  currency,
}: {
  trip: Trip;
  items: Tables<"quote_items">[];
  currency: string;
}) {
  const totals = [
    { label: "Total", value: Number(trip.total_due ?? 0) },
    { label: "Paid", value: Number(trip.amount_paid ?? 0) },
    { label: "Balance", value: Number(trip.balance_due ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((entry) => (
          <div key={entry.label} className="rounded-xl border border-bone p-4">
            <p className="text-[11px] tracking-wide text-ash uppercase">
              {entry.label}
            </p>
            <p
              className={cn(
                "tabular mt-1 text-subheading font-semibold",
                entry.label === "Balance" && entry.value > 0
                  ? "text-orange-600"
                  : "text-ink",
              )}
            >
              {formatMoney(entry.value, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-body-sm text-slate">Payment status</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-[3px] text-[12px] font-semibold",
            PAYMENT_TONE[trip.payment_status] ?? "bg-plaster text-slate",
          )}
        >
          {trip.payment_status}
        </span>
      </div>

      {items.length === 0 ? (
        <Empty
          title="No charge breakdown"
          body="Charges live on the quote this reservation came from. A job entered straight onto the board has a total but no itemised lines."
        />
      ) : (
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-[11px] tracking-wide text-ash uppercase">
              <th scope="col" className="pb-2 text-left font-semibold">
                Description
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Unit
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-bone">
                <td className="py-2 text-ink">{item.description}</td>
                <td className="tabular py-2 text-right text-slate">
                  {formatNumber(Number(item.quantity))}
                </td>
                <td className="tabular py-2 text-right text-slate">
                  {formatMoney(Number(item.unit_price), currency)}
                </td>
                <td className="tabular py-2 text-right font-medium text-ink">
                  {formatMoney(Number(item.amount), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const BASIS_LABEL: Record<string, string> = {
  FLAT: "Flat",
  HOURLY: "Per hour",
  DAILY: "Per day",
  MILEAGE: "Per km",
};

/** What the drivers on this job are owed for it. */
export function DriverPayPanel({
  entries,
  currency,
}: {
  entries: DriverPayLine[];
  currency: string;
}) {
  if (entries.length === 0) {
    return (
      <Empty
        title="No driver pay yet"
        body="Pay is built from completed assignments, so it follows what actually ran rather than what was planned. Assign a driver and complete the trip."
        action={{ href: "/driver-pay", label: "Driver pay" }}
      />
    );
  }

  const total = entries.reduce(
    (sum, entry) => sum + Number(entry.total_pay ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-ash uppercase">
            <th scope="col" className="pb-2 text-left font-semibold">
              Driver
            </th>
            <th scope="col" className="pb-2 text-left font-semibold">
              Basis
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Rate
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Pay
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-bone">
              <td className="py-2 font-medium text-ink">
                {entry.driverName ?? "Unassigned"}
              </td>
              <td className="py-2 text-slate">
                {BASIS_LABEL[entry.rate_basis] ?? entry.rate_basis}
              </td>
              <td className="tabular py-2 text-right text-slate">
                {formatMoney(Number(entry.rate), currency)}
              </td>
              <td className="tabular py-2 text-right text-slate">
                {formatNumber(Number(entry.quantity))}
              </td>
              <td className="tabular py-2 text-right font-medium text-ink">
                {formatMoney(Number(entry.total_pay), currency)}
              </td>
              <td className="py-2 text-right">
                <Badge variant="outline">{entry.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-bone">
            <td colSpan={4} className="py-2 font-semibold text-ink">
              Total
            </td>
            <td className="tabular py-2 text-right font-semibold text-ink">
              {formatMoney(total, currency)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Anything that went wrong, or needs chasing, on this job. */
export function TicketsPanel({
  tickets,
  timeZone,
}: {
  tickets: Tables<"tickets">[];
  timeZone: string;
}) {
  if (tickets.length === 0) {
    return (
      <Empty
        title="No tickets"
        body="Raise one against this reservation when something goes wrong — a breakdown, a late arrival, a complaint — so it stays attached to the job rather than living in somebody's inbox."
        action={{ href: "/tickets", label: "Tickets" }}
      />
    );
  }

  return (
    <ul className="divide-y divide-bone">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="py-3">
          <Link
            href={`/tickets?ticket=${ticket.id}`}
            className="group flex items-start justify-between gap-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-body-sm font-medium text-ink group-hover:underline">
                {ticket.title}
              </span>
              <span className="mt-0.5 block text-[12px] text-ash">
                {ticket.reference ? `${ticket.reference} · ` : ""}
                {ticket.ticket_type ?? "Other"} ·{" "}
                {formatDateTime(ticket.created_at, timeZone)}
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <Badge variant="outline">{ticket.severity}</Badge>
              <Badge variant="secondary">{ticket.status}</Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Not built.
 *
 * Said plainly rather than left as an empty list, which would read as "nothing
 * has been sent" and let an operator believe a customer had been told something
 * they have not.
 */
export function NotificationsPanel() {
  return (
    <div className="rounded-xl border border-dashed border-cloud bg-mist/40 px-6 py-10 text-center">
      <Hammer className="mx-auto size-5 text-ash" aria-hidden="true" />
      <p className="mt-2 text-body-sm font-semibold text-ink">
        Notifications are not built yet
      </p>
      <p className="mx-auto mt-1 max-w-[52ch] text-body-sm text-slate">
        There is no record of what has been sent about a reservation, and nothing
        is sent automatically. Quotes and invoices are emailed by hand from their
        own screens, and those sends are not logged here.
      </p>
    </div>
  );
}
