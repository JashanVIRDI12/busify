import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Send } from "lucide-react";

import {
  emailInvoicesAction,
  markInvoicesSentAction,
} from "@/app/(dashboard)/payments/actions";
import {
  ClearFiltersButton,
  DateFilter,
  FilterBar,
  MultiFilter,
  SearchField,
} from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import { StatusPill } from "@/components/data/status-pill";
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
import { RecordPayment } from "@/components/payments/record-payment";
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
import { canWriteFinance } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const PAYMENT_VALUES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;

const PAYMENT_OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "PAID", label: "Paid" },
  { value: "REFUNDED", label: "Refunded" },
];

const TONE = {
  UNPAID: "orange",
  PARTIAL: "violet",
  PAID: "teal",
  REFUNDED: "neutral",
} as const;

/**
 * The money side of the reservations list: what is owed, what has landed, and
 * what still needs an invoice. It reads the same rows as Reservations rather
 * than a separate ledger — a payment that is not against a job is not a thing
 * this product models.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const params = parseListParams(await searchParams, { defaultPer: 50 });
  const zone = organization.timezone;
  const currency = organization.currency;

  const supabase = await createClient();

  let query = supabase
    .from("trips")
    .select("*, companies(name), customers(first_name, last_name)", {
      count: "exact",
    })
    .gt("total_due", 0)
    .order("departure_at", { ascending: false })
    .range(params.from, params.to);

  if (params.q) {
    query = query.or(ilikeAcross(["reference", "group_name"], params.q));
  }

  const payments = only(params.filters.payment, PAYMENT_VALUES);
  if (payments.length) query = query.in("payment_status", payments);

  const range = resolveDateRange(filterValue(params, "pickup"), zone);
  if (range?.gte) query = query.gte("departure_at", range.gte);
  if (range?.lte) query = query.lte("departure_at", range.lte);

  const { data, count, error } = await query;

  const rows = data ?? [];
  const total = count ?? 0;
  const canEdit = canWriteFinance(role);

  const outstanding = rows.reduce((sum, trip) => sum + Number(trip.balance_due), 0);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Payments"
        count={total}
        actions={
          <p className="text-body-sm text-slate">
            <span className="tabular font-semibold text-ink">
              {formatMoney(outstanding, currency, { precise: true })}
            </span>{" "}
            outstanding on this page
          </p>
        }
      />

      <FilterBar>
        <SearchField placeholder="Search" />
        <MultiFilter
          paramKey="payment"
          label="Payment Status"
          options={PAYMENT_OPTIONS}
        />
        <DateFilter paramKey="pickup" label="Pickup" />
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
        <DataTable className="min-w-[72rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Res. ID</TH>
            <TH>Company</TH>
            <TH>Booking Contact</TH>
            <TH>Pickup</TH>
            <TH>Invoiced</TH>
            <TH>Collected</TH>
            <TH>Balance</TH>
            <TH>Status</TH>
            <TH>Invoice Sent</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow colSpan={10} message="Payments could not be loaded." />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={10}
                message="Nothing invoiced yet — a reservation appears here once it has a total"
              />
            ) : (
              rows.map((trip) => (
                <TR key={trip.id}>
                  <TD>
                    <RowCheckbox id={trip.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/reservations/${trip.id}`}
                      className="tabular font-medium hover:text-teal-600 hover:underline"
                    >
                      {trip.reference ?? "--"}
                    </Link>
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
                    {formatMoney(trip.total_due, currency, { precise: true })}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {canEdit ? (
                      <RecordPayment
                        tripId={trip.id}
                        totalDue={Number(trip.total_due)}
                        amountPaid={Number(trip.amount_paid)}
                        currency={currency}
                      />
                    ) : (
                      <span className="tabular">
                        {formatMoney(trip.amount_paid, currency, { precise: true })}
                      </span>
                    )}
                  </TD>
                  <TD className="tabular whitespace-nowrap">
                    {formatMoney(trip.balance_due, currency, { precise: true })}
                  </TD>
                  <TD>
                    <StatusPill
                      label={
                        PAYMENT_OPTIONS.find(
                          (option) => option.value === trip.payment_status,
                        )?.label ?? trip.payment_status
                      }
                      tone={TONE[trip.payment_status]}
                    />
                  </TD>
                  <TD className="tabular whitespace-nowrap">
                    {trip.invoice_sent_at ? (
                      formatStamp(trip.invoice_sent_at, zone, {
                        shortYear: true,
                        withZone: false,
                      })
                    ) : (
                      <span className="text-ash">Not sent</span>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      <BulkActionBar
        noun="reservation"
        actions={
          canEdit
            ? [
                {
                  label: "Email invoice",
                  icon: <Mail className="size-3.5" />,
                  run: async (ids: string[]) => {
                    const result = await emailInvoicesAction(ids);
                    if (!result.ok) return { ok: false, message: result.message };

                    const { sent, delivered, skipped } = result.data;
                    const base = delivered
                      ? `Emailed ${sent} invoice${sent === 1 ? "" : "s"}`
                      : `Marked ${sent} sent — no mail provider is configured, so nothing was delivered`;

                    return {
                      ok: true,
                      message: skipped.length
                        ? `${base}. Skipped: ${skipped.join("; ")}`
                        : base,
                    };
                  },
                },
                {
                  label: "Mark sent",
                  icon: <Send className="size-3.5" />,
                  run: async (ids: string[]) => {
                    const result = await markInvoicesSentAction(ids);
                    return result.ok
                      ? { ok: true, message: "Invoices marked as sent" }
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
