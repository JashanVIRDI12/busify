import type { Metadata } from "next";
import { Inbox, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TRIP_REQUEST_STATUS_LABELS } from "@/components/shared/status-badge";
import { TripRequestCard } from "@/components/trip-requests/trip-request-card";
import { TripRequestDialog } from "@/components/trip-requests/trip-request-dialog";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TRIP_REQUEST_STATUSES } from "@/lib/validations/trip-request";
import type { TripRequestStatus } from "@/types/database";

export const metadata: Metadata = { title: "Trip requests" };

function parseStatus(value: string | undefined): TripRequestStatus | null {
  return TRIP_REQUEST_STATUSES.includes(value as TripRequestStatus)
    ? (value as TripRequestStatus)
    : null;
}

export default async function TripRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { role, organization } = await requireSession();
  const { q, status } = await searchParams;
  const activeStatus = parseStatus(status);

  const supabase = await createClient();

  const [{ data: statusRows }, { data: customers }] = await Promise.all([
    supabase.from("trip_requests").select("status"),
    supabase
      .from("customers")
      .select("id, first_name, last_name, company")
      .order("first_name"),
  ]);

  let query = supabase
    .from("trip_requests")
    .select("*")
    .order("departure_at", { ascending: true })
    .limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `reference.ilike.${term},pickup_location.ilike.${term},destination.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  const requests = data ?? [];

  const counts = new Map<TripRequestStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...TRIP_REQUEST_STATUSES.map((value) => ({
      label: TRIP_REQUEST_STATUS_LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  const writeAllowed = canWrite(role);
  const deleteAllowed = canManage(role);
  const timeZone = organization.timezone;
  const customerOptions = customers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip requests"
        description="Every enquiry that came in, and what still needs a decision from you."
        actions={
          writeAllowed ? (
            <TripRequestDialog
              customers={customerOptions}
              timeZone={timeZone}
              trigger={
                <Button>
                  <Plus />
                  New request
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
            <SearchInput placeholder="Search reference, route, contact…" />
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={Inbox}
            title="We could not load your trip requests"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              q || activeStatus
                ? "No requests match those filters"
                : "No trip requests yet"
            }
            description={
              q || activeStatus
                ? "Clear the search or pick a different status to see the rest."
                : "Log an enquiry here, or wait for one to arrive from your website once the booking widget is live."
            }
            action={
              !q && !activeStatus && writeAllowed ? (
                <TripRequestDialog
                  customers={customerOptions}
                  timeZone={timeZone}
                  trigger={
                    <Button>
                      <Plus />
                      Log your first request
                    </Button>
                  }
                />
              ) : null
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <TripRequestCard
                key={request.id}
                request={request}
                customers={customerOptions}
                timeZone={timeZone}
                canEdit={writeAllowed}
                canDelete={deleteAllowed}
              />
            ))}
          </div>
        )}
      </ListShell>
    </div>
  );
}
