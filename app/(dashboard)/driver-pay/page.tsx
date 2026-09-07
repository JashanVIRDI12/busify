import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { issuePayStubsAction } from "@/app/(dashboard)/driver-pay/actions";
import {
  ClearFiltersButton,
  DateFilter,
  FilterBar,
  MultiFilter,
  SearchField,
  SingleFilter,
} from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import { PageTabs } from "@/components/data/page-tabs";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import { PAY_STATUS, StatusPill, pillFor } from "@/components/data/status-pill";
import {
  Blank,
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCard,
} from "@/components/data/table";
import { TablePagination } from "@/components/data/table-pagination";
import {
  DriverPayActions,
  PayStubActions,
} from "@/components/driver-pay/pay-actions";
import { requireSession } from "@/lib/auth/session";
import { resolveDateRange } from "@/lib/date-filters";
import { formatStamp, formatWeekdayStamp } from "@/lib/datetime";
import {
  filterValue,
  ilikeAcross,
  only,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canWriteFinance } from "@/lib/permissions";
import { requestNow } from "@/lib/request-time";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Driver Pay" };

const PAY_STATUS_VALUES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "PAID",
  "VOID",
] as const;

const PAY_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

export default async function DriverPayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved, { defaultPer: 10 });
  const zone = organization.timezone;
  const currency = organization.currency;

  const tab = resolved.tab === "stubs" ? "stubs" : "reservations";
  const canEdit = canWriteFinance(role);

  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, first_name, last_name")
    .order("first_name")
    .limit(300);

  const driverOptions = (drivers ?? []).map((driver) => ({
    value: driver.id,
    label: [driver.first_name, driver.last_name].filter(Boolean).join(" "),
  }));

  const tabs = [
    { key: "reservations", label: "Reservations", href: "/driver-pay" },
    { key: "stubs", label: "Pay Stubs", href: "/driver-pay?tab=stubs" },
  ];

  if (tab === "stubs") {
    let query = supabase
      .from("driver_pay_stubs")
      .select("*, drivers(id, first_name, last_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(params.from, params.to);

    if (params.q) query = query.or(ilikeAcross(["reference"], params.q));

    const driverId = filterValue(params, "driver");
    if (driverId) query = query.eq("driver_id", driverId);

    const paidRange = resolveDateRange(filterValue(params, "paid"), zone);
    if (paidRange?.gte) query = query.gte("payment_date", paidRange.gte.slice(0, 10));
    if (paidRange?.lte) query = query.lte("payment_date", paidRange.lte.slice(0, 10));

    const { data, count, error } = await query;
    const rows = data ?? [];
    const total = count ?? 0;

    // The reservation numbers a stub covers are not on the stub itself, so they
    // are gathered for the visible page only.
    const stubIds = rows.map((row) => row.id);
    const { data: entries } = stubIds.length
      ? await supabase
          .from("driver_pay_entries")
          .select("pay_stub_id, trips(reference)")
          .in("pay_stub_id", stubIds)
      : { data: [] };

    const references = new Map<string, string[]>();
    for (const entry of entries ?? []) {
      if (!entry.pay_stub_id) continue;
      const list = references.get(entry.pay_stub_id) ?? [];
      if (entry.trips?.reference) list.push(entry.trips.reference);
      references.set(entry.pay_stub_id, list);
    }

    return (
      <SelectionProvider ids={stubIds}>
        <PageHeading title="Driver Pay" count={total} />
        <PageTabs tabs={tabs} active={tab} />

        <div className="panel p-4">
          <FilterBar trailing={<PayStubActions />}>
            <SearchField placeholder="Search Pay Stubs" />
            <SingleFilter
              paramKey="driver"
              label="Driver"
              options={driverOptions}
            />
            <DateFilter paramKey="paid" label="Payment Date" />
            <ClearFiltersButton />
          </FilterBar>

          <TableCard
            footer={
              <TablePagination
                page={params.page}
                pageCount={pageCount(total, params.per)}
                perPage={params.per}
              />
            }
          >
            <DataTable className="min-w-[74rem]">
              <THead>
                <TH width="44px">
                  <SelectAllCheckbox />
                </TH>
                <TH>Pay Stub</TH>
                <TH>Status</TH>
                <TH>Driver</TH>
                <TH>Reservation ID</TH>
                <TH>Total Pay</TH>
                <TH>Payment Date</TH>
                <TH>Pay Range</TH>
              </THead>

              <TBody>
                {error ? (
                  <EmptyRow colSpan={8} message="Those pay stubs could not be loaded." />
                ) : rows.length === 0 ? (
                  <EmptyRow colSpan={8} message="No data found" />
                ) : (
                  rows.map((stub) => {
                    const status = pillFor(PAY_STATUS, stub.status);
                    const list = references.get(stub.id) ?? [];
                    return (
                      <TR key={stub.id}>
                        <TD>
                          <RowCheckbox id={stub.id} />
                        </TD>
                        <TD className="font-medium">{stub.reference}</TD>
                        <TD>
                          <StatusPill label={status.label} tone={status.tone} />
                        </TD>
                        <TD>
                          {[stub.drivers?.first_name, stub.drivers?.last_name]
                            .filter(Boolean)
                            .join(" ") || <Blank />}
                        </TD>
                        <TD className="tabular max-w-[20rem] truncate">
                          {list.length > 0 ? list.join(", ") : <Blank />}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {formatMoney(stub.total_pay, currency, { precise: true })}
                        </TD>
                        <TD className="tabular whitespace-nowrap">
                          {stub.payment_date ?? <Blank />}
                        </TD>
                        <TD className="whitespace-nowrap">
                          {stub.period_start && stub.period_end
                            ? `${formatWeekdayStamp(stub.period_start, zone)} - ${formatWeekdayStamp(stub.period_end, zone)}`
                            : <Blank />}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </DataTable>
          </TableCard>
        </div>
      </SelectionProvider>
    );
  }

  // --- Reservations tab -----------------------------------------------------
  let query = supabase
    .from("driver_pay_entries")
    .select(
      `*,
       drivers(id, first_name, last_name),
       trips(id, reference, status, departure_at, companies(name), customers(first_name, last_name))`,
      { count: "exact" },
    )
    .order("starts_at", { ascending: false, nullsFirst: false })
    .range(params.from, params.to);

  const statuses = only(params.filters.status, PAY_STATUS_VALUES);
  if (statuses.length) query = query.in("status", statuses);

  const driverId = filterValue(params, "driver");
  if (driverId) query = query.eq("driver_id", driverId);

  const startRange = resolveDateRange(filterValue(params, "start"), zone);
  if (startRange?.gte) query = query.gte("starts_at", startRange.gte);
  if (startRange?.lte) query = query.lte("starts_at", startRange.lte);

  const { data, count, error } = await query;

  // The search box on this tab looks up reservation numbers, which live one
  // table over, so it filters the page rather than the query.
  const term = params.q.toLowerCase();
  const rows = (data ?? []).filter(
    (entry) => !term || entry.trips?.reference?.toLowerCase().includes(term),
  );
  const total = count ?? 0;
  const now = requestNow();

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading title="Driver Pay" count={total} />
      <PageTabs tabs={tabs} active={tab} />

      <div className="panel p-4">
        <FilterBar trailing={<DriverPayActions canEdit={canEdit} />}>
          <SearchField placeholder="Search Reservation ID" />
          <SingleFilter paramKey="driver" label="Driver" options={driverOptions} />
          <MultiFilter
            paramKey="status"
            label="Status"
            options={PAY_STATUS_OPTIONS}
          />
          <DateFilter paramKey="start" label="Start" />
          <ClearFiltersButton />
        </FilterBar>

        <TableCard
          footer={
            <TablePagination
              page={params.page}
              pageCount={pageCount(total, params.per)}
              perPage={params.per}
            />
          }
        >
          <DataTable className="min-w-[80rem]">
            <THead>
              <TH width="44px">
                <SelectAllCheckbox />
              </TH>
              <TH>Res. ID</TH>
              <TH>Res. Status</TH>
              <TH>Driver</TH>
              <TH>Status</TH>
              <TH>Total Pay</TH>
              <TH>Start</TH>
              <TH>End</TH>
              <TH>Company</TH>
              <TH>Booking Contact</TH>
            </THead>

            <TBody>
              {error ? (
                <EmptyRow colSpan={10} message="Driver pay could not be loaded." />
              ) : rows.length === 0 ? (
                <EmptyRow
                  colSpan={10}
                  message="No pay rows yet — Review Drafts creates one per driver assignment"
                />
              ) : (
                rows.map((entry) => {
                  const status = pillFor(PAY_STATUS, entry.status);
                  const upcoming =
                    entry.trips?.departure_at !== undefined &&
                    entry.trips?.departure_at !== null &&
                    new Date(entry.trips.departure_at).getTime() > now;

                  return (
                    <TR key={entry.id}>
                      <TD>
                        <RowCheckbox id={entry.id} />
                      </TD>
                      <TD>
                        {entry.trips ? (
                          <Link
                            href={`/reservations/${entry.trips.id}`}
                            className="tabular font-medium hover:text-teal-600 hover:underline"
                          >
                            {entry.trips.reference ?? "--"}
                          </Link>
                        ) : (
                          <Blank />
                        )}
                      </TD>
                      <TD>{upcoming ? "Upcoming" : "Past"}</TD>
                      <TD>
                        {[entry.drivers?.first_name, entry.drivers?.last_name]
                          .filter(Boolean)
                          .join(" ") || <Blank />}
                      </TD>
                      <TD>
                        <StatusPill label={status.label} tone={status.tone} />
                      </TD>
                      <TD className="tabular whitespace-nowrap">
                        {formatMoney(entry.total_pay, currency, { precise: true })}
                      </TD>
                      <TD className="tabular whitespace-nowrap">
                        {entry.starts_at ? formatStamp(entry.starts_at, zone) : <Blank />}
                      </TD>
                      <TD className="tabular whitespace-nowrap">
                        {entry.ends_at ? formatStamp(entry.ends_at, zone) : <Blank />}
                      </TD>
                      <TD>{entry.trips?.companies?.name ?? <Blank />}</TD>
                      <TD>
                        {entry.trips?.customers
                          ? [
                              entry.trips.customers.first_name,
                              entry.trips.customers.last_name,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : <Blank />}
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </DataTable>
        </TableCard>
      </div>

      <BulkActionBar
        noun="pay row"
        actions={
          canEdit
            ? [
                {
                  label: "Issue pay stubs",
                  icon: <Receipt className="size-3.5" />,
                  run: async (ids: string[]) => {
                    const result = await issuePayStubsAction(ids);
                    return result.ok
                      ? {
                          ok: true,
                          message: `Issued ${result.data.stubs} pay ${
                            result.data.stubs === 1 ? "stub" : "stubs"
                          }`,
                        }
                      : { ok: false, message: result.message };
                  },
                },
              ]
            : []
        }
      />
    </SelectionProvider>
  );
}
