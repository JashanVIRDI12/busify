import type { Metadata } from "next";
import Link from "next/link";
import { BusFront, Layers, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs, type FilterTab } from "@/components/shared/filter-tabs";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import {
  VEHICLE_STATUS_LABELS,
  VehicleStatusBadge,
} from "@/components/shared/status-badge";
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog";
import { VehicleRowActions } from "@/components/vehicles/vehicle-row-actions";
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
import { VEHICLE_STATUSES } from "@/lib/validations/vehicle";
import type { VehicleStatus } from "@/types/database";

export const metadata: Metadata = { title: "Fleet" };

function parseStatus(value: string | undefined): VehicleStatus | null {
  return VEHICLE_STATUSES.includes(value as VehicleStatus)
    ? (value as VehicleStatus)
    : null;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { role } = await requireSession();
  const { q, status } = await searchParams;
  const activeStatus = parseStatus(status);

  const supabase = await createClient();

  const [{ data: vehicleTypes }, { data: statusRows }] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id, name, default_capacity")
      .order("name"),
    supabase.from("vehicles").select("status"),
  ]);

  let query = supabase.from("vehicles").select("*").order("name").limit(300);

  if (activeStatus) query = query.eq("status", activeStatus);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `name.ilike.${term},registration_number.ilike.${term},make.ilike.${term},model.ilike.${term},location.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  const vehicles = data ?? [];

  const counts = new Map<VehicleStatus, number>();
  for (const row of statusRows ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const tabs: FilterTab[] = [
    { label: "All", value: null, count: statusRows?.length ?? 0 },
    ...VEHICLE_STATUSES.map((value) => ({
      label: VEHICLE_STATUS_LABELS[value],
      value,
      count: counts.get(value) ?? 0,
    })),
  ];

  const writeAllowed = canWrite(role);
  const deleteAllowed = canManage(role);
  const types = vehicleTypes ?? [];
  const typeNames = new Map(types.map((type) => [type.id, type.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        description="Every coach, mini bus and van you can put against a trip."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/vehicles/types">
                <Layers />
                Vehicle types
              </Link>
            </Button>
            {writeAllowed && (
              <VehicleDialog
                vehicleTypes={types}
                trigger={
                  <Button>
                    <Plus />
                    Add vehicle
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <ListShell
        toolbar={
          <>
            <FilterTabs tabs={tabs} />
            <SearchInput placeholder="Search name, registration, make…" />
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={BusFront}
            title="We could not load your fleet"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={BusFront}
            title={
              q || activeStatus ? "No vehicles match those filters" : "No vehicles yet"
            }
            description={
              q || activeStatus
                ? "Clear the search or pick a different status to see the rest of your fleet."
                : "Add your coaches so dispatchers can check availability and quote against real capacity."
            }
            action={
              !q && !activeStatus && writeAllowed ? (
                <VehicleDialog
                  vehicleTypes={types}
                  trigger={
                    <Button>
                      <Plus />
                      Add your first vehicle
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
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <span className="block font-medium">{vehicle.name}</span>
                    <span className="tabular block text-xs text-muted-foreground">
                      {vehicle.registration_number}
                      {vehicle.make || vehicle.model
                        ? ` · ${[vehicle.year, vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ")}`
                        : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(vehicle.vehicle_type_id &&
                      typeNames.get(vehicle.vehicle_type_id)) ||
                      "—"}
                  </TableCell>
                  <TableCell className="tabular text-right font-medium">
                    {vehicle.capacity}
                  </TableCell>
                  <TableCell>
                    <VehicleStatusBadge status={vehicle.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vehicle.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <VehicleRowActions
                      vehicle={vehicle}
                      vehicleTypes={types}
                      canEdit={writeAllowed}
                      canDelete={deleteAllowed}
                    />
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
