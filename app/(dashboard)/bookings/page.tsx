import type { Metadata } from "next";
import Link from "next/link";
import { TicketCheck } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

export const metadata: Metadata = { title: "Bookings" };

const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

const LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TONE: Record<
  BookingStatus,
  "default" | "success" | "warning" | "destructive" | "muted"
> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { organization } = await requireSession();
  const { status } = await searchParams;
  const activeStatus = BOOKING_STATUSES.includes(status as BookingStatus)
    ? (status as BookingStatus)
    : null;

  const supabase = await createClient();
  const { data: statusRows } = await supabase.from("bookings").select("status");

  let query = supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);

  const [{ data, error }, { data: customers }, { data: trips }] = await Promise.all([
    query,
    supabase.from("customers").select("id, first_name, last_name"),
    supabase.from("trips").select("id, pickup_location, destination, departure_at"),
  ]);

  const bookings = data ?? [];

  const customerName = new Map(
    (customers ?? []).map((c) => [
      c.id,
      [c.first_name, c.last_name].filter(Boolean).join(" "),
    ]),
  );
  const tripById = new Map((trips ?? []).map((t) => [t.id, t]));

  const counts = new Map<BookingStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...BOOKING_STATUSES.map((value) => ({
      label: LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Confirmed work and what is still owed on it. A booking is created when a customer accepts their quote."
      />

      <ListShell
        toolbar={<FilterTabs tabs={tabs} />}
        footer="Recording payments against a booking arrives in a later phase."
      >
        {error ? (
          <EmptyState
            icon={TicketCheck}
            title="We could not load your bookings"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={TicketCheck}
            title={activeStatus ? "No bookings with that status" : "No bookings yet"}
            description={
              activeStatus
                ? "Pick a different status to see the rest."
                : "Send a quote. When the customer accepts it, the booking and the trip are created here automatically."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const trip = booking.trip_id ? tripById.get(booking.trip_id) : null;

                return (
                  <TableRow key={booking.id}>
                    <TableCell className="tabular font-medium">
                      {booking.booking_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      {trip ? (
                        <Link
                          href={`/trips/${trip.id}`}
                          className="text-sm hover:underline"
                        >
                          {trip.pickup_location} → {trip.destination}
                          <span className="tabular block text-xs text-muted-foreground">
                            {formatDateTime(trip.departure_at, organization.timezone)}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {booking.customer_id
                        ? (customerName.get(booking.customer_id) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatMoney(Number(booking.total_amount), booking.currency)}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {formatMoney(Number(booking.balance_amount), booking.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TONE[booking.status]}>
                        {LABELS[booking.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListShell>
    </div>
  );
}
