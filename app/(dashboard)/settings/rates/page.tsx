import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  deleteVehicleRatesAction,
  saveVehicleRateAction,
} from "@/app/(dashboard)/settings/catalog-actions";
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
import { RecordDrawer, type FieldSpec } from "@/components/settings/record-drawer";
import { Tip } from "@/components/shared/tip";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Vehicle Rates" };

export default async function VehicleRatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const currency = organization.currency;

  const supabase = await createClient();
  const [{ data, count }, { data: types }, { data: vehicles }] =
    await Promise.all([
      supabase
        .from("vehicle_rates")
        .select("*, vehicle_types(id, name), vehicles(id, name)", {
          count: "exact",
        })
        .order("created_at", { ascending: true }),
      supabase.from("vehicle_types").select("id, name").order("name").limit(100),
      supabase.from("vehicles").select("id, name").order("name").limit(300),
    ]);

  const rows = data ?? [];
  const manageAllowed = canManage(role);

  // Typed, not picked. On a new organization there are no vehicle types yet,
  // so a dropdown here is an empty list in front of the first thing an operator
  // needs to do. A name they type that does not exist becomes a vehicle type;
  // a vehicle has to already exist, because a real coach needs a plate and a
  // capacity that cannot be invented from a rate row.
  const fields: FieldSpec[] = [
    {
      kind: "combo",
      name: "vehicle_type_name",
      label: "Vehicle Type",
      required: true,
      suggestions: (types ?? []).map((type) => type.name),
      hint: "Type a new name to create the vehicle type.",
    },
    {
      kind: "combo",
      name: "vehicle_name",
      label: "Vehicle (leave blank for the type default)",
      suggestions: (vehicles ?? []).map((vehicle) => vehicle.name),
      hint: "Leave blank to set the rate for every vehicle of this type.",
    },
    { kind: "money", name: "live_mile_rate", label: "Live Mile", half: true },
    { kind: "money", name: "dead_mile_rate", label: "Dead Mile", half: true },
    { kind: "money", name: "hourly_rate", label: "Hourly", half: true },
    { kind: "number", name: "minimum_hours", label: "Min Hours", half: true },
    { kind: "money", name: "daily_rate", label: "Daily", half: true },
  ];

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Vehicle Rates"
        count={count ?? rows.length}
        actions={
          manageAllowed ? (
            <RecordDrawer
              title="Add Rate"
              action={saveVehicleRateAction}
              fields={fields}
              submitLabel="Add Rate"
              trigger={
                <Button>
                  <Plus />
                  Add Rate
                </Button>
              }
            />
          ) : null
        }
      />

      <Tip className="mb-3">
        These rates are what the quote builder prices from — the base fare is the
        highest of daily, hourly or per-kilometre. Without a rate here, quotes
        come out at $0.00.
      </Tip>

      <TableCard>
        <DataTable className="min-w-[56rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>ID</TH>
            <TH>Type</TH>
            <TH>Vehicle</TH>
            <TH>Live Mile</TH>
            <TH>Dead Mile</TH>
            <TH>Hourly</TH>
            <TH>Min Hours</TH>
            <TH>Daily</TH>
          </THead>

          <TBody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={9}
                message="No rates yet — add one per vehicle type to start quoting"
              />
            ) : (
              rows.map((rate, index) => (
                <TR key={rate.id}>
                  <TD>
                    <RowCheckbox id={rate.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/settings/rates?edit=${rate.id}`}
                      scroll={false}
                      className="tabular text-teal-600 hover:underline"
                    >
                      {index + 1}
                    </Link>
                  </TD>
                  <TD>{rate.vehicle_types?.name ?? <Blank />}</TD>
                  <TD>
                    {/* A rate with no vehicle is the default for its whole type,
                        which is what almost every operator has. */}
                    {rate.vehicles?.name ?? (
                      <span className="text-slate">Default</span>
                    )}
                  </TD>
                  <TD className="tabular">
                    {formatMoney(rate.live_mile_rate, currency, { precise: true })}
                  </TD>
                  <TD className="tabular">
                    {formatMoney(rate.dead_mile_rate, currency, { precise: true })}
                  </TD>
                  <TD className="tabular">
                    {formatMoney(rate.hourly_rate, currency, { precise: true })}
                  </TD>
                  <TD className="tabular">{rate.minimum_hours} hours</TD>
                  <TD className="tabular">
                    {formatMoney(rate.daily_rate, currency, { precise: true })}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <RecordDrawer
          key={editing.id}
          title="Edit Rate"
          action={saveVehicleRateAction}
          fields={[{ kind: "hidden", name: "id", value: editing.id }, ...fields]}
          // The row carries the type and vehicle as embeds; the form works in
          // names, so flatten them for the two combo fields to prefill from.
          values={{
            ...editing,
            vehicle_type_name: editing.vehicle_types?.name ?? "",
            vehicle_name: editing.vehicles?.name ?? "",
          }}
          routed
        />
      )}

      <BulkActionBar
        noun="rate"
        canDelete={manageAllowed}
        onDelete={deleteVehicleRatesAction}
      />
    </SelectionProvider>
  );
}
