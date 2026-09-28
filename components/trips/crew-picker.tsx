"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignToTripAction,
  assignmentOptionsAction,
  setAssignmentPartAction,
  type AssignmentOption,
} from "@/app/(dashboard)/reservations/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** One assignment row, as much of it as picking a coach or a driver needs. */
export type CrewRow = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  driverId: string | null;
  driverName: string | null;
};

export type CrewOptions = {
  vehicles: AssignmentOption[];
  drivers: AssignmentOption[];
} | null;

/**
 * Who is free for a trip, fetched once when it is shown and again whenever its
 * crew changes, since a driver just put on it is no longer free. Null while
 * loading, and always null when `enabled` is false.
 */
export function useCrewOptions(
  tripId: string | null,
  rows: CrewRow[],
  enabled: boolean,
): CrewOptions {
  const key = tripId
    ? `${tripId}:${rows.map((row) => `${row.vehicleId}/${row.driverId}`).join(",")}`
    : null;
  const [loaded, setLoaded] = useState<{ key: string; options: CrewOptions } | null>(null);

  useEffect(() => {
    if (!key || !tripId || !enabled) return;
    let live = true;
    assignmentOptionsAction(tripId).then((result) => {
      if (live && result.ok) setLoaded({ key, options: result.data });
    });
    return () => {
      live = false;
    };
  }, [key, tripId, enabled]);

  return enabled && loaded?.key === key ? loaded.options : null;
}

/**
 * A coach or a driver, pickable where it is read.
 *
 * Reads as the name it already shows until reached for, like the quote rail's
 * inline selects. An empty slot is orange, the product's colour for a gap to
 * fill, so a job with a coach and no driver is visibly unfinished. Only what is
 * free for the trip's dates is offered, and the server checks again on save.
 */
export function CrewPicker({
  kind,
  tripId,
  row,
  options,
  canEdit,
  emptyLabel = "Unassigned",
  assignedClassName = "text-teal-700",
}: {
  kind: "vehicle" | "driver";
  tripId: string;
  /** Null when the trip has no assignment row yet. */
  row: CrewRow | null;
  options: CrewOptions;
  canEdit: boolean;
  emptyLabel?: string;
  /** Colour of a filled slot; empty is always orange. */
  assignedClassName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currentId = (kind === "vehicle" ? row?.vehicleId : row?.driverId) ?? null;
  const currentName = (kind === "vehicle" ? row?.vehicleName : row?.driverName) ?? null;
  const free = options ? (kind === "vehicle" ? options.vehicles : options.drivers) : null;
  const noun = kind === "vehicle" ? "vehicles" : "drivers";
  const tone = currentName ? assignedClassName : "text-orange-600";

  if (!canEdit) {
    return (
      <span className={cn("block truncate text-body-sm font-medium", tone)}>
        {currentName ?? emptyLabel}
      </span>
    );
  }

  function choose(value: string) {
    const next = value === NONE ? null : value;
    if (next === currentId) return;

    startTransition(async () => {
      let message: string | null = null;
      if (row) {
        const result = await setAssignmentPartAction({
          assignment_id: row.id,
          field: kind === "vehicle" ? "vehicle_id" : "driver_id",
          value: next,
        });
        if (!result.ok) message = result.message;
      } else if (next) {
        // Nothing on the trip yet: the ordinary assign, which creates the row.
        const data = new FormData();
        data.set("trip_id", tripId);
        data.set(kind === "vehicle" ? "vehicle_id" : "driver_id", next);
        const result = await assignToTripAction({ status: "idle" }, data);
        if (result.status === "error") message = result.message ?? "Could not assign.";
      }

      if (message) {
        toast.error(message);
        return;
      }
      const name = next === null ? null : free?.find((option) => option.id === next)?.label;
      toast.success(
        next === null
          ? `${kind === "vehicle" ? "Vehicle" : "Driver"} removed.`
          : `${name ?? (kind === "vehicle" ? "Vehicle" : "Driver")} assigned.`,
      );
      router.refresh();
    });
  }

  return (
    <Select value={currentId ?? NONE} onValueChange={choose} disabled={pending}>
      <SelectTrigger
        size="sm"
        aria-label={kind === "vehicle" ? "Vehicle" : "Driver"}
        className={cn(
          // The max width gives back the 4px that -ml-1 borrows. At plain 100%,
          // a cell sized to fit the name comes up 4px short and "Coach 101"
          // truncates to "Coach 1…".
          "-ml-1 h-7 w-auto max-w-[calc(100%+0.25rem)] shrink-0 gap-1 border-none px-1 text-left text-body-sm font-medium whitespace-nowrap shadow-none hover:bg-mist [&>span]:truncate",
          tone,
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Saving
          </span>
        ) : (
          <SelectValue>{currentName ?? emptyLabel}</SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {currentId && currentName && (
          <SelectItem value={currentId}>{currentName}</SelectItem>
        )}
        {free === null ? (
          <SelectItem value="__loading__" disabled>
            Checking who is free…
          </SelectItem>
        ) : free.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            No {noun} free on these dates
          </SelectItem>
        ) : (
          free.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
              {option.detail && (
                <span className="ml-2 text-[12px] text-ash">{option.detail}</span>
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
