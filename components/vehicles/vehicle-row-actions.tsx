"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { deleteVehicleAction } from "@/app/(dashboard)/vehicles/actions";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/types/database";

export function VehicleRowActions({
  vehicle,
  vehicleTypes,
  canEdit,
  canDelete,
}: {
  vehicle: Tables<"vehicles">;
  vehicleTypes: Pick<Tables<"vehicle_types">, "id" | "name" | "default_capacity">[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canEdit && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${vehicle.name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <VehicleDialog
          vehicle={vehicle}
          vehicleTypes={vehicleTypes}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canDelete && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={vehicle.id}
          action={deleteVehicleAction}
          title={`Delete ${vehicle.name}?`}
          description="Maintenance records for this vehicle are removed with it. Trips that already used it keep their history. This cannot be undone."
          successMessage="Vehicle deleted."
        />
      )}
    </>
  );
}
