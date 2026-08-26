"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { deleteVehicleTypeAction } from "@/app/(dashboard)/vehicles/actions";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { VehicleTypeDialog } from "@/components/vehicles/vehicle-type-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/types/database";

export function VehicleTypeRowActions({
  vehicleType,
  currency,
  vehicleCount,
  canEdit,
  canDelete,
}: {
  vehicleType: Tables<"vehicle_types">;
  currency: string;
  vehicleCount: number;
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
            aria-label={`Actions for ${vehicleType.name}`}
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
        <VehicleTypeDialog
          vehicleType={vehicleType}
          currency={currency}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canDelete && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={vehicleType.id}
          action={deleteVehicleTypeAction}
          title={`Delete ${vehicleType.name}?`}
          description={
            vehicleCount > 0
              ? `${vehicleCount} ${vehicleCount === 1 ? "vehicle uses" : "vehicles use"} this type. They will stay in your fleet but become untyped.`
              : "No vehicles use this type. This cannot be undone."
          }
          successMessage="Vehicle type deleted."
        />
      )}
    </>
  );
}
