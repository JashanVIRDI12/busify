import type { Metadata } from "next";
import { BusFront } from "lucide-react";

import {
  ClearFiltersButton,
  DateFilter,
  FilterBar,
  MultiFilter,
  SearchField,
  SingleFilter,
} from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import { SaveViewButton, SavedViews } from "@/components/data/saved-views";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import { StatusPill, TRIP_STATUS, pillFor } from "@/components/data/status-pill";
import {
  Blank,
  DataTable,
  EmptyRow,
  RowLink,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCard,
} from "@/components/data/table";
import { TablePagination } from "@/components/data/table-pagination";
import { Tip } from "@/components/shared/tip";
import { requireSession } from "@/lib/auth/session";
import { resolveDateRange } from "@/lib/date-filters";
import { formatStamp } from "@/lib/datetime";
import {
  filterValue,
  ilikeAcross,
  only,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { getSavedViews } from "@/lib/queries/saved-views";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Reservations" };

const STATUS_VALUES = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const PAYMENT_VALUES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;
const ASSIGNMENT_VALUES = ["UNASSIGNED", "PARTIAL", "ASSIGNED"] as const;

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ASSIGNMENT_OPTIONS = [
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "PARTIAL", label: "Partially assigned" },
  { value: "ASSIGNED", label: "Assigned" },
];

const PAYMENT_OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "PAID", label: "Paid" },
  { value: "REFUNDED", label: "Refunded" },
];

const SYSTEM_VIEWS = [
  { name: "Upcoming", query: "pickup=future", locked: true },
  { name: "All Reservations", query: "" },
  { name: "Unpaid", query: "payment=UNPAID,PARTIAL" },
  { name: "Next 3 Days", query: "pickup=next-3" },
];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { organization } = await requireSession();
  const params = parseListParams(await searchParams, { defaultPer: 50 });
  const zone = organization.timezone;

  const supabase = await createClient();

  let query = supabase
    .from("trips")
    .select(
      `*,
       companies(id, name),
       customers(id, first_name, last_name),
       trip_assignments(
         id, role,
         vehicles(id, name),
         drivers(id, first_name, last_name)
       )`,
      { count: "exact" },
    )
    .order("departure_at", { ascending: params.dir !== "desc" })
    .range(params.from, params.to);

  if (params.q) {
    query = query.or(
      ilikeAcross(
        ["reference", "pickup_location", "destination", "group_name"],
        params.q,
      ),
    );
  }

  const statuses = only(params.filters.status, STATUS_VALUES);
  if (statuses.length) query = query.in("status", statuses);

  const [assignment] = only(
    [filterValue(params, "assignment") ?? ""],
    ASSIGNMENT_VALUES,
  );
  if (assignment) query = query.eq("assignment_status", assignment);

  const payments = only(params.filters.payment, PAYMENT_VALUES);
  if (payments.length) query = query.in("payment_status", payments);

  const pickupRange = resolveDateRange(filterValue(params, "pickup"), zone);
  if (pickupRange?.gte) query = query.gte("departure_at", pickupRange.gte);
  if (pickupRange?.lte) query = query.lte("departure_at", pickupRange.lte);

  const [{ data, count, error }, views] = await Promise.all([
    query,
    getSavedViews("reservations"),
  ]);

  const rows = data ?? [];
  const total = count ?? 0;

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Reservations"
        count={total}
        views={<SavedViews systemViews={SYSTEM_VIEWS} views={views} />}
      />

      <FilterBar trailing={<SaveViewButton resource="reservations" />}>
        <SearchField placeholder="Search" />
        <MultiFilter paramKey="status" label="Res. Status" options={STATUS_OPTIONS} />
        <SingleFilter
          paramKey="assignment"
          label="Assignment Status"
          options={ASSIGNMENT_OPTIONS}
          width="w-[186px]"
        />
        <MultiFilter
          paramKey="payment"
          label="Payment Status"
          options={PAYMENT_OPTIONS}
        />
        <DateFilter paramKey="pickup" label="Pickup" />
        <ClearFiltersButton />
      </FilterBar>

      <Tip className="-mt-1 mb-1">Click any row to open the reservation — assign a coach and driver, record a payment, or send the invoice.</Tip>

      <TableCard
        footer={
          <TablePagination
            page={params.page}
            pageCount={pageCount(total, params.per)}
            perPage={params.per}
          />
        }
      >
        <DataTable className="min-w-[88rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH width="40px" />
            <TH>Res. ID</TH>
            <TH>Res. Status</TH>
            <TH>Company</TH>
            <TH>Booking Contact</TH>
            <TH>Pickup</TH>
            <TH>Total Due</TH>
            <TH>Balance</TH>
            <TH>Vehicle</TH>
            <TH>Driver</TH>
            <TH>Last Activity</TH>
            <TH>Invoice Sent</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={13}
                message="Those reservations could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={13} message="No data found" />
            ) : (
              rows.map((trip) => {
                const status = pillFor(TRIP_STATUS, trip.status);
                const assignments = trip.trip_assignments ?? [];
                const vehicles = assignments
                  .map((entry) => entry.vehicles?.name)
                  .filter((name): name is string => Boolean(name));
                const drivers = assignments
                  .map((entry) =>
                    entry.drivers
                      ? [entry.drivers.first_name, entry.drivers.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : null,
                  )
                  .filter((name): name is string => Boolean(name));

                return (
                  <TR key={trip.id} interactive>
                    <TD className="relative z-10">
                      <RowCheckbox id={trip.id} />
                    </TD>
                    <TD>
                      {/* Colour, not a second column: the whole point of this
                          glyph is that an unassigned run is visible while
                          scanning the ID column, not after reading across. */}
                      <BusFront
                        className={cn(
                          "size-[18px]",
                          trip.assignment_status === "ASSIGNED"
                            ? "text-teal-500"
                            : trip.assignment_status === "PARTIAL"
                              ? "text-amber"
                              : "text-orange-500",
                        )}
                        aria-label={`Assignment ${trip.assignment_status.toLowerCase()}`}
                      />
                    </TD>
                    <TD>
                      <RowLink
                        href={`/reservations/${trip.id}`}
                        label={`Open reservation ${trip.reference ?? ""}`}
                        className="tabular font-medium"
                      >
                        {trip.reference ?? "--"}
                      </RowLink>
                    </TD>
                    <TD>
                      <StatusPill label={status.label} tone={status.tone} uppercase />
                    </TD>
                    <TD>{trip.companies?.name ?? <Blank />}</TD>
                    <TD>
                      {trip.customers
                        ? [trip.customers.first_name, trip.customers.last_name]
                            .filter(Boolean)
                            .join(" ")
                        : <Blank />}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(trip.departure_at, zone, {
                        shortYear: true,
                        withZone: false,
                      })}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={cn(
                            "size-[6px] rounded-full",
                            trip.payment_status === "PAID"
                              ? "bg-teal-500"
                              : trip.payment_status === "PARTIAL"
                                ? "bg-amber"
                                : "bg-fog",
                          )}
                        />
                        {formatMoney(trip.total_due, organization.currency, {
                          precise: true,
                        })}
                      </span>
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatMoney(trip.balance_due, organization.currency, {
                        precise: true,
                      })}
                    </TD>
                    <TD>
                      <AssignmentCell
                        names={vehicles}
                        placeholder="Vehicle"
                        count={assignments.length}
                      />
                    </TD>
                    <TD>
                      <AssignmentCell
                        names={drivers}
                        placeholder="Driver"
                        count={assignments.length}
                      />
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(trip.last_activity_at, zone, {
                        shortYear: true,
                        withZone: false,
                      })}
                    </TD>
                    <TD>
                      {trip.invoice_sent_at ? (
                        "Sent"
                      ) : (
                        <span className="text-ash">Not sent</span>
                      )}
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </DataTable>
      </TableCard>
    </SelectionProvider>
  );
}

/**
 * Shows what is actually assigned, or an orange count of what still needs to
 * be. The orange is the one place in a table row that means "do something".
 */
function AssignmentCell({
  names,
  placeholder,
  count,
}: {
  names: string[];
  placeholder: string;
  count: number;
}) {
  if (names.length > 0) {
    return (
      <span className="text-teal-600">
        {names.slice(0, 2).join(", ")}
        {names.length > 2 && ` +${names.length - 2}`}
      </span>
    );
  }

  const needed = Math.max(1, count);
  return (
    <span className="text-orange-500">
      {needed} {placeholder}
      {needed === 1 ? "" : "s"}
    </span>
  );
}
