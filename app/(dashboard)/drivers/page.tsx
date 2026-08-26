import type { Metadata } from "next";
import { Plus, TriangleAlert, UserSquare } from "lucide-react";

import { DriverDialog } from "@/components/drivers/driver-dialog";
import { DriverRowActions } from "@/components/drivers/driver-row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import {
  DRIVER_STATUS_LABELS,
  DriverStatusBadge,
} from "@/components/shared/status-badge";
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
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DRIVER_STATUSES } from "@/lib/validations/driver";
import type { DriverStatus } from "@/types/database";

export const metadata: Metadata = { title: "Drivers" };

const DAY_MS = 86_400_000;

function parseStatus(value: string | undefined): DriverStatus | null {
  return DRIVER_STATUSES.includes(value as DriverStatus)
    ? (value as DriverStatus)
    : null;
}

/** Days until a licence expires; negative once it already has. */
function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.round((target - today) / DAY_MS);
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { role } = await requireSession();
  const { q, status } = await searchParams;
  const activeStatus = parseStatus(status);

  const supabase = await createClient();

  const { data: statusRows } = await supabase.from("drivers").select("status");

  let query = supabase
    .from("drivers")
    .select("*")
    .order("first_name")
    .limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term},license_number.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  const drivers = data ?? [];

  const counts = new Map<DriverStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...DRIVER_STATUSES.map((value) => ({
      label: DRIVER_STATUS_LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  const writeAllowed = canWrite(role);
  const deleteAllowed = canManage(role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Your roster, their licences, and who is available to take a trip."
        actions={
          writeAllowed ? (
            <DriverDialog
              trigger={
                <Button>
                  <Plus />
                  Add driver
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
            <SearchInput placeholder="Search name, phone, licence…" />
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={UserSquare}
            title="We could not load your drivers"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : drivers.length === 0 ? (
          <EmptyState
            icon={UserSquare}
            title={
              q || activeStatus ? "No drivers match those filters" : "No drivers yet"
            }
            description={
              q || activeStatus
                ? "Clear the search or pick a different status to see the rest of your roster."
                : "Add your drivers so you can assign them to trips and track licence expiry."
            }
            action={
              !q && !activeStatus && writeAllowed ? (
                <DriverDialog
                  trigger={
                    <Button>
                      <Plus />
                      Add your first driver
                    </Button>
                  }
                />
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => {
                const remaining = driver.license_expires_on
                  ? daysUntil(driver.license_expires_on)
                  : null;
                const expiringSoon = remaining !== null && remaining <= 30;

                return (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      {[driver.first_name, driver.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {driver.email && (
                        <a
                          href={`mailto:${driver.email}`}
                          className="block text-interactive hover:underline"
                        >
                          {driver.email}
                        </a>
                      )}
                      <span className="tabular block text-xs">
                        {driver.phone ?? (driver.email ? "" : "—")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular block">
                        {driver.license_number ?? "—"}
                      </span>
                      {driver.license_expires_on && (
                        <span
                          className={
                            expiringSoon
                              ? "mt-0.5 flex items-center gap-1 text-xs font-medium text-warning"
                              : "mt-0.5 block text-xs text-muted-foreground"
                          }
                        >
                          {expiringSoon && (
                            <TriangleAlert className="size-3" aria-hidden />
                          )}
                          {remaining !== null && remaining < 0
                            ? `Expired ${driver.license_expires_on}`
                            : `Expires ${driver.license_expires_on}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DriverStatusBadge status={driver.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DriverRowActions
                        driver={driver}
                        canEdit={writeAllowed}
                        canDelete={deleteAllowed}
                      />
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
