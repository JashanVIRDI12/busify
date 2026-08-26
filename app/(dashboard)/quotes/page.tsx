import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { QuoteBuilderDialog } from "@/components/quotes/quote-builder-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/datetime";
import { canWriteFinance } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { QUOTE_STATUSES } from "@/lib/validations/quote";
import type { QuoteStatus } from "@/types/database";

export const metadata: Metadata = { title: "Quotes" };

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

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { role, organization } = await requireSession();
  const { q, status } = await searchParams;
  const activeStatus = QUOTE_STATUSES.includes(status as QuoteStatus)
    ? (status as QuoteStatus)
    : null;

  const supabase = await createClient();

  const [{ data: statusRows }, { data: vehicleTypes }, { data: customers }] =
    await Promise.all([
      supabase.from("quotes").select("status"),
      supabase
        .from("vehicle_types")
        .select("id, name, base_rate, per_km_rate, per_hour_rate, default_capacity")
        .order("name"),
      supabase
        .from("customers")
        .select("id, first_name, last_name, company")
        .order("first_name"),
    ]);

  let query = supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);
  if (q?.trim()) query = query.ilike("quote_number", `%${q.trim()}%`);

  const { data, error } = await query;
  const quotes = data ?? [];

  const customerName = new Map(
    (customers ?? []).map((customer) => [
      customer.id,
      [customer.first_name, customer.last_name].filter(Boolean).join(" "),
    ]),
  );

  const counts = new Map<QuoteStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...QUOTE_STATUSES.map((value) => ({
      label: STATUS_LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  const writeAllowed = canWriteFinance(role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description="Prices you have put in front of customers, and what came back."
        actions={
          writeAllowed ? (
            <QuoteBuilderDialog
              vehicleTypes={vehicleTypes ?? []}
              customers={customers ?? []}
              currency={organization.currency}
              province={organization.state}
              trigger={
                <Button>
                  <Plus />
                  New quote
                </Button>
              }
            />
          ) : null
        }
      />

      <ListShell
        toolbar={
          <>
            <FilterTabs tabs={tabs} />
            <SearchInput placeholder="Search quote number…" />
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={FileText}
            title="We could not load your quotes"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={q || activeStatus ? "No quotes match those filters" : "No quotes yet"}
            description={
              q || activeStatus
                ? "Clear the search or pick a different status."
                : "Price a trip request, or start a quote from scratch. Rates come from your vehicle types."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="tabular font-medium text-interactive hover:underline"
                    >
                      {quote.quote_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {quote.customer_id
                      ? (customerName.get(quote.customer_id) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular text-right font-medium">
                    {formatMoney(Number(quote.total), quote.currency)}
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {formatMoney(Number(quote.deposit_amount), quote.currency)}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {quote.valid_until
                      ? formatDate(`${quote.valid_until}T00:00:00Z`, organization.timezone)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[quote.status]}>
                      {STATUS_LABELS[quote.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListShell>
    </div>
  );
}
