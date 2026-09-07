import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteVehiclesAction } from "@/app/(dashboard)/vehicles/actions";
import { SearchField } from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
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
import { VehicleDrawer } from "@/components/vehicles/vehicle-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import {
  ilikeAcross,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vehicles" };

const SEARCHABLE = ["name", "make", "model", "registration_number", "vin"];

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);

  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, vehicle_types(id, name), garages(id, name)", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(SEARCHABLE, params.q));

  const [{ data, count, error }, { data: types }, { data: garages }] =
    await Promise.all([
      query,
      supabase.from("vehicle_types").select("id, name").order("name").limit(100),
      supabase.from("garages").select("id, name").order("name").limit(200),
    ]);

  const rows = data ?? [];
  const typeOptions = types ?? [];
  const garageOptions = garages ?? [];
  const total = count ?? 0;
  const writeAllowed = canWrite(role);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Vehicles"
        count={total}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href="/vehicles/types">Vehicle Types</Link>
            </Button>
            {writeAllowed && (
              <VehicleDrawer
                vehicleTypes={typeOptions}
                garages={garageOptions}
                trigger={
                  <Button>
                    <Plus />
                    Add Vehicle
                  </Button>
                }
              />
            )}
          </>
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
        <DataTable className="min-w-[62rem]">
          <THead>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Capacity</TH>
            <TH>Make</TH>
            <TH>Model</TH>
            <TH>Year</TH>
            <TH>Garage</TH>
            <TH>Included</TH>
            <TH>Sync</TH>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={10}
                message="That fleet could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={10}
                message={
                  params.q ? "No vehicles match that search" : "No vehicles yet"
                }
              />
            ) : (
              rows.map((vehicle) => (
                <TR key={vehicle.id}>
                  <TD>
                    <Link
                      href={`/vehicles?edit=${vehicle.id}`}
                      scroll={false}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {vehicle.name}
                    </Link>
                  </TD>
                  <TD>{vehicle.vehicle_types?.name ?? <Blank />}</TD>
                  <TD className="tabular">{vehicle.capacity}</TD>
                  <TD>{vehicle.make ?? <Blank />}</TD>
                  <TD>{vehicle.model ?? <Blank />}</TD>
                  <TD className="tabular">{vehicle.year ?? <Blank />}</TD>
                  <TD>{vehicle.garages?.name ?? <Blank />}</TD>
                  <TD className={vehicle.is_mock ? "text-slate" : undefined}>
                    {vehicle.is_mock ? "Excluded" : "Included"}
                  </TD>
                  <TD>{vehicle.external_ref ?? <Blank />}</TD>
                  <TD>
                    <RowCheckbox id={vehicle.id} />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <VehicleDrawer
          key={editing.id}
          vehicle={editing}
          vehicleTypes={typeOptions}
          garages={garageOptions}
          routed
        />
      )}

      <BulkActionBar
        noun="vehicle"
        canDelete={canManage(role)}
        onDelete={deleteVehiclesAction}
      />
    </SelectionProvider>
  );
}
