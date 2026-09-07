import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteTicketsAction } from "@/app/(dashboard)/tickets/actions";
import { SearchField } from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import {
  StatusPill,
  TICKET_STATUS,
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
import { TicketDrawer, type TicketComment } from "@/components/tickets/ticket-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { formatStamp, formatStampDate } from "@/lib/datetime";
import {
  ilikeAcross,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canManage, canWrite } from "@/lib/permissions";
import { getPeople, peopleById } from "@/lib/queries/people";
import { createClient } from "@/lib/supabase/server";
import { TICKET_SEVERITY_LABELS } from "@/lib/validations/ticket";

export const metadata: Metadata = { title: "Tickets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);
  const zone = organization.timezone;

  const supabase = await createClient();

  let query = supabase
    .from("tickets")
    .select("*, trips(id, reference, departure_at)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(["title", "reference"], params.q));

  const [{ data, count, error }, people, { data: reservations }] =
    await Promise.all([
      query,
      getPeople(),
      supabase
        .from("trips")
        .select("id, reference, pickup_location, departure_at")
        .order("departure_at", { ascending: false })
        .limit(300),
    ]);

  const rows = data ?? [];
  const total = count ?? 0;
  const names = peopleById(people);
  const writeAllowed = canWrite(role);

  const reservationOptions = (reservations ?? []).map((trip) => ({
    value: trip.id,
    label: trip.reference ?? trip.id.slice(0, 8),
    hint: `${trip.pickup_location} · ${formatStampDate(trip.departure_at, zone)}`,
  }));

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  // Only the open ticket's thread is fetched, not every row's.
  let comments: TicketComment[] = [];
  if (editing) {
    const { data: commentRows } = await supabase
      .from("ticket_comments")
      .select("id, body, created_at, author_id")
      .eq("ticket_id", editing.id)
      .order("created_at", { ascending: true })
      .limit(200);

    comments = (commentRows ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      author: row.author_id ? (names[row.author_id] ?? "Unknown") : "Unknown",
    }));
  }

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Tickets"
        count={total}
        actions={
          writeAllowed ? (
            <TicketDrawer
              reservations={reservationOptions}
              people={people}
              trigger={
                <Button>
                  <Plus />
                  Create New
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="mb-3.5">
        <SearchField placeholder="Search" />
      </div>

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
            <TH>Ticket ID</TH>
            <TH>Title</TH>
            <TH>Status</TH>
            <TH>Type</TH>
            <TH>Priority</TH>
            <TH>Res ID</TH>
            <TH>Pickup Date</TH>
            <TH>Created By</TH>
            <TH>Assignee</TH>
            <TH>Created On</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={11}
                message="Those tickets could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={11} message="No data found" />
            ) : (
              rows.map((ticket) => {
                const status = pillFor(TICKET_STATUS, ticket.status);
                return (
                  <TR key={ticket.id}>
                    <TD>
                      <RowCheckbox id={ticket.id} />
                    </TD>
                    <TD>
                      <Link
                        href={`/tickets?edit=${ticket.id}`}
                        scroll={false}
                        className="font-medium text-teal-600 hover:underline"
                      >
                        {ticket.reference ?? "--"}
                      </Link>
                    </TD>
                    <TD className="max-w-[18rem] truncate">{ticket.title}</TD>
                    <TD>
                      <StatusPill label={status.label} tone={status.tone} />
                    </TD>
                    <TD>{ticket.ticket_type ?? <Blank />}</TD>
                    <TD>
                      {TICKET_SEVERITY_LABELS[ticket.severity] ?? ticket.severity}
                    </TD>
                    <TD>
                      {ticket.trips ? (
                        <Link
                          href={`/reservations?edit=${ticket.trips.id}`}
                          className="text-teal-600 hover:underline"
                        >
                          {ticket.trips.reference ?? "--"}
                        </Link>
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {ticket.trips?.departure_at ? (
                        formatStamp(ticket.trips.departure_at, zone)
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>
                      {ticket.created_by ? (
                        (names[ticket.created_by] ?? <Blank />)
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>
                      {ticket.assignee_id ? (
                        (names[ticket.assignee_id] ?? <Blank />)
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(ticket.created_at, zone)}
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <TicketDrawer
          key={editing.id}
          ticket={editing}
          reservations={reservationOptions}
          people={people}
          comments={comments}
          routed
        />
      )}

      <BulkActionBar
        noun="ticket"
        canDelete={canManage(role)}
        onDelete={deleteTicketsAction}
      />
    </SelectionProvider>
  );
}
