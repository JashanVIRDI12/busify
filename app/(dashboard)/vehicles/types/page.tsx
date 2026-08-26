import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { VehicleTypeDialog } from "@/components/vehicles/vehicle-type-dialog";
import { VehicleTypeRowActions } from "@/components/vehicles/vehicle-type-row-actions";
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
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Vehicle types" };

export default async function VehicleTypesPage() {
  const { role, organization } = await requireSession();
  const supabase = await createClient();

  const [{ data: vehicleTypes, error }, { data: vehicles }] = await Promise.all([
    supabase.from("vehicle_types").select("*").order("name"),
    supabase.from("vehicles").select("vehicle_type_id"),
  ]);

  const usage = new Map<string, number>();
  for (const vehicle of vehicles ?? []) {
    if (!vehicle.vehicle_type_id) continue;
    usage.set(
      vehicle.vehicle_type_id,
      (usage.get(vehicle.vehicle_type_id) ?? 0) + 1,
    );
  }

  const writeAllowed = canWrite(role);
  const deleteAllowed = canManage(role);
  const currency = organization.currency;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/vehicles">
          <ArrowLeft />
          Back to fleet
        </Link>
      </Button>

      <PageHeader
        title="Vehicle types"
        description="Group your fleet by class and hold the rates that quoting will calculate from."
        actions={
          writeAllowed ? (
            <VehicleTypeDialog
              currency={currency}
              trigger={
                <Button>
                  <Plus />
                  Add type
                </Button>
              }
            />
          ) : null
        }
      />

      <ListShell>
        {error || !vehicleTypes || vehicleTypes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={error ? "We could not load vehicle types" : "No vehicle types yet"}
            description={
              error
                ? "The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
                : "Create classes like Luxury Coach or Mini Bus. Rates here become the starting point for every quote."
            }
            action={
              !error && writeAllowed ? (
                <VehicleTypeDialog
                  currency={currency}
                  trigger={
                    <Button>
                      <Plus />
                      Add your first type
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
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Vehicles</TableHead>
                <TableHead className="text-right">Default seats</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Per km</TableHead>
                <TableHead className="text-right">Per hour</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicleTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <span className="block font-medium">{type.name}</span>
                    {type.description && (
                      <span className="block max-w-md truncate text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {usage.get(type.id) ?? 0}
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {type.default_capacity ?? "—"}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatMoney(Number(type.base_rate), currency)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatMoney(Number(type.per_km_rate), currency, {
                      precise: true,
                    })}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatMoney(Number(type.per_hour_rate), currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <VehicleTypeRowActions
                      vehicleType={type}
                      currency={currency}
                      vehicleCount={usage.get(type.id) ?? 0}
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
