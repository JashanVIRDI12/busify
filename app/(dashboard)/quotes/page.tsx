import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { createQuoteDraftAction } from "@/app/(dashboard)/quotes/builder-actions";
import {
  ClearFiltersButton,
  DateFilter,
  FilterBar,
  MultiFilter,
  SearchField,
} from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import { SaveViewButton, SavedViews } from "@/components/data/saved-views";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import {
  QUOTE_PIPELINE_STATUS,
  StatusPill,
  pillFor,
} from "@/components/data/status-pill";
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
import { Button } from "@/components/ui/button";
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
import { getPeople, peopleById } from "@/lib/queries/people";
import { requestNow } from "@/lib/request-time";
import { getSavedViews } from "@/lib/queries/saved-views";
import { createClient } from "@/lib/supabase/server";
import { QUOTE_PRIORITY_LABELS, enumOptions } from "@/lib/taxonomy";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotes" };

const PIPELINE_VALUES = ["LEAD", "QUOTED", "FOLLOW_UP", "WON", "LOST"] as const;
const PRIORITY_VALUES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const PIPELINE_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "QUOTED", label: "Sent" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

/**
 * "Leads" is the view an operator lives in: everything still in play. It ships
 * as a system chip rather than a saved view so a new organization has somewhere
 * to start before anyone has saved anything.
 */
const SYSTEM_VIEWS = [
  { name: "Leads", query: "status=LEAD,QUOTED,FOLLOW_UP&pickup=future", locked: true },
  { name: "All Quotes", query: "" },
];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { organization } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);
  const zone = organization.timezone;

  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("*, companies(id, name)", { count: "exact" })
    .order(params.sort === "pickup" ? "pickup_at" : "created_at", {
      ascending: params.dir === "asc",
      nullsFirst: false,
    })
    .range(params.from, params.to);

  if (params.q) {
    query = query.or(ilikeAcross(["reference", "title", "pickup_address"], params.q));
  }

  const statuses = only(params.filters.status, PIPELINE_VALUES);
  if (statuses.length) query = query.in("pipeline_status", statuses);

  const priorities = only(params.filters.priority, PRIORITY_VALUES);
  if (priorities.length) query = query.in("priority", priorities);

  const pickupRange = resolveDateRange(filterValue(params, "pickup"), zone);
  if (pickupRange?.gte) query = query.gte("pickup_at", pickupRange.gte);
  if (pickupRange?.lte) query = query.lte("pickup_at", pickupRange.lte);

  const [{ data, count, error }, people, views] = await Promise.all([
    query,
    getPeople(),
    getSavedViews("quotes"),
  ]);

  const rows = data ?? [];
  const total = count ?? 0;
  const names = peopleById(people);

  // Quotes reach customers through two foreign keys, so the booking contact is
  // read separately rather than embedded. One query for the whole page.
  const contactIds = [
    ...new Set(rows.map((row) => row.customer_id).filter((id): id is string => !!id)),
  ];
  const contacts = contactIds.length
    ? ((
        await supabase
          .from("customers")
          .select("id, first_name, last_name")
          .in("id", contactIds)
      ).data ?? [])
    : [];
  const contactName = Object.fromEntries(
    contacts.map((contact) => [
      contact.id,
      [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    ]),
  );

  const now = requestNow();

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Quotes"
        count={total}
        views={<SavedViews systemViews={SYSTEM_VIEWS} views={views} />}
        actions={
          <form action={createQuoteDraftAction}>
            <Button type="submit">
              <Plus />
              Add Quote
            </Button>
          </form>
        }
      />

      <FilterBar trailing={<SaveViewButton resource="quotes" />}>
        <SearchField placeholder="Search" />
        <MultiFilter
          paramKey="status"
          label="Quote Status"
          options={PIPELINE_OPTIONS}
        />
        <MultiFilter
          paramKey="priority"
          label="Priority"
          options={enumOptions(QUOTE_PRIORITY_LABELS)}
        />
        <DateFilter paramKey="pickup" label="Pickup Date" />
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
        <DataTable className="min-w-[92rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Quote ID</TH>
            <TH>Quote Status</TH>
            <TH>Sales Rep</TH>
            <TH>Priority</TH>
            <TH>Company</TH>
            <TH>Booking Contact</TH>
            <TH>Event Type</TH>
            <TH>Pickup Date</TH>
            <TH>First Pickup Address</TH>
            <TH>Total</TH>
            <TH>Created</TH>
            <TH>Expiration Date</TH>
            <TH>Created By</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={14}
                message="Those quotes could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={14} message="No data found" />
            ) : (
              rows.map((quote) => {
                const status = pillFor(QUOTE_PIPELINE_STATUS, quote.pipeline_status);
                const expired =
                  quote.expires_at !== null &&
                  new Date(quote.expires_at).getTime() < now;

                return (
                  <TR key={quote.id}>
                    <TD>
                      <RowCheckbox id={quote.id} />
                    </TD>
                    <TD>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="tabular font-medium hover:text-teal-600 hover:underline"
                      >
                        {quote.reference ?? quote.quote_number ?? "--"}
                      </Link>
                    </TD>
                    <TD>
                      <StatusPill label={status.label} tone={status.tone} />
                    </TD>
                    <TD>
                      {quote.sales_rep_id ? (
                        (names[quote.sales_rep_id] ?? <Blank />)
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>
                      {quote.priority ? (
                        (QUOTE_PRIORITY_LABELS[quote.priority] ?? quote.priority)
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>{quote.companies?.name ?? <Blank />}</TD>
                    <TD>
                      {(quote.customer_id && contactName[quote.customer_id]) || (
                        <Blank />
                      )}
                    </TD>
                    <TD>{quote.event_type ?? <Blank />}</TD>
                    <TD className="tabular whitespace-nowrap">
                      {quote.pickup_at ? formatStamp(quote.pickup_at, zone) : <Blank />}
                    </TD>
                    <TD className="max-w-[22rem] truncate">
                      {quote.pickup_address ?? <Blank />}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatMoney(quote.total, quote.currency, { precise: true })}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(quote.created_at, zone)}
                    </TD>
                    <TD
                      className={cn(
                        "tabular whitespace-nowrap",
                        expired && "text-orange-600",
                      )}
                    >
                      {quote.expires_at ? formatStamp(quote.expires_at, zone) : ""}
                    </TD>
                    <TD>
                      {quote.created_by ? (
                        (names[quote.created_by] ?? <Blank />)
                      ) : (
                        <Blank />
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
