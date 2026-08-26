"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { deleteDriverAction } from "@/app/(dashboard)/drivers/actions";
import { DriverDialog } from "@/components/drivers/driver-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/types/database";

export function DriverRowActions({
  driver,
  canEdit,
  canDelete,
}: {
  driver: Tables<"drivers">;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canEdit && !canDelete) return null;

  const displayName = [driver.first_name, driver.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${displayName}`}
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
        <DriverDialog
          driver={driver}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canDelete && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={driver.id}
          action={deleteDriverAction}
          title={`Delete ${displayName}?`}
          description="Their uploaded documents and availability windows are removed with them. This cannot be undone."
          successMessage="Driver deleted."
        />
      )}
    </>
  );
}
