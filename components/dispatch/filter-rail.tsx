"use client";

import { SingleFilter, type FilterOption } from "@/components/data/filters";
import { Switch } from "@/components/ui/switch";
import { useListParams } from "@/lib/hooks/use-list-params";

/**
 * The dispatch calendar's left rail.
 *
 * Filters are stacked full-width rather than laid out in a row because the
 * calendar grid beside them wants every horizontal pixel, and because a
 * dispatcher sets these once in the morning and then reads the grid all day.
 */
export function DispatchFilterRail({
  statuses,
  assignments,
  drivers,
  vehicles,
  vehicleTypes,
  garages,
}: {
  statuses: FilterOption[];
  assignments: FilterOption[];
  drivers: FilterOption[];
  vehicles: FilterOption[];
  vehicleTypes: FilterOption[];
  garages: FilterOption[];
}) {
  const { get, setParams } = useListParams();
  const notesOn = get("notes") !== "off";

  return (
    <div className="space-y-3">
      <SingleFilter
        paramKey="status"
        label="Status"
        options={statuses}
        width="w-full"
      />
      <SingleFilter
        paramKey="assignment"
        label="Assignment Status"
        options={assignments}
        width="w-full"
      />
      <SingleFilter
        paramKey="driver"
        label="Driver"
        options={drivers}
        width="w-full"
      />
      <SingleFilter
        paramKey="vehicle"
        label="Vehicle Name"
        options={vehicles}
        width="w-full"
      />
      <SingleFilter
        paramKey="vehicleType"
        label="Vehicle Type"
        options={vehicleTypes}
        width="w-full"
      />
      <SingleFilter
        paramKey="garage"
        label="Garage"
        options={garages}
        width="w-full"
      />

      <label className="flex items-center gap-2.5 pt-1 text-body-sm text-carbon">
        <Switch
          checked={notesOn}
          onCheckedChange={(next) => setParams({ notes: next ? null : "off" })}
          className="data-[state=checked]:bg-teal-500"
        />
        Calendar Notes
      </label>
    </div>
  );
}
