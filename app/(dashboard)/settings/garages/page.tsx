import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteGaragesAction } from "@/app/(dashboard)/garages/actions";
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
import { GarageDrawer } from "@/components/garages/garage-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Garages" };

export default async function GaragesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;

  const supabase = await createClient();

  // Counted here rather than with an embedded aggregate: an operator has a
  // handful of depots, and two flat reads are easier to follow than a nested
  // count whose shape depends on the PostgREST version.
  const [{ data, count }, { data: vehicles }, { data: drivers }] =
    await Promise.all([
      supabase
        .from("garages")
        .select("*", { count: "exact" })
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),
      supabase.from("vehicles").select("garage_id").limit(2000),
      supabase.from("drivers").select("garage_id").limit(2000),
    ]);

  const rows = data ?? [];

  function tally(source: { garage_id: string | null }[] | null) {
    const totals = new Map<string, number>();
    for (const row of source ?? []) {
      if (!row.garage_id) continue;
      totals.set(row.garage_id, (totals.get(row.garage_id) ?? 0) + 1);
    }
    return totals;
  }

  const vehicleCounts = tally(vehicles);
  const driverCounts = tally(drivers);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Garages"
        count={count ?? rows.length}
        actions={
          canWrite(role) ? (
            <GarageDrawer
              trigger={
                <Button>
                  <Plus />
                  Add Garage
                </Button>
              }
            />
          ) : null
        }
      />

      <TableCard>
        <DataTable>
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Name</TH>
            <TH>Address</TH>
            <TH># of Vehicles</TH>
            <TH># of Drivers</TH>
            <TH>Default</TH>
          </THead>

          <TBody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message="No garages yet — add the depots your coaches run from"
              />
            ) : (
              rows.map((garage) => (
                <TR key={garage.id}>
                  <TD>
                    <RowCheckbox id={garage.id} />
                  </TD>
                  <TD className="font-medium">{garage.name}</TD>
                  <TD>
                    <Link
                      href={`/settings/garages?edit=${garage.id}`}
                      scroll={false}
                      className="text-teal-600 hover:underline"
                    >
                      {[
                        garage.address,
                        garage.city,
                        garage.province,
                        garage.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Add an address"}
                    </Link>
                  </TD>
                  <TD className="tabular">{vehicleCounts.get(garage.id) ?? 0}</TD>
                  <TD className="tabular">{driverCounts.get(garage.id) ?? 0}</TD>
                  <TD>
                    {garage.is_default ? (
                      <StatusPill label="Default" tone="teal" />
                    ) : (
                      <Blank />
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && <GarageDrawer key={editing.id} garage={editing} routed />}

      <BulkActionBar
        noun="garage"
        canDelete={canManage(role)}
        onDelete={deleteGaragesAction}
      />
    </SelectionProvider>
  );
}
