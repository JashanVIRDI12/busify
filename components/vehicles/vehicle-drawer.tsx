"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, Info, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createVehicleAction,
  updateVehicleAction,
} from "@/app/(dashboard)/vehicles/actions";
import {
  FormAlert,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  DrawerRow,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import { VEHICLE_AMENITIES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Vehicle = Tables<"vehicles">;
type Option = { id: string; name: string };

export function VehicleDrawer({
  trigger,
  vehicle,
  vehicleTypes,
  garages,
  routed = false,
}: {
  trigger?: ReactNode;
  vehicle?: Vehicle;
  vehicleTypes: Option[];
  garages: Option[];
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(vehicle);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateVehicleAction : createVehicleAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Vehicle updated" : "Vehicle added");
        close();
      },
    },
  );

  return (
    <>
      {trigger && (
        <span
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {trigger}
        </span>
      )}

      <SideDrawer
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={editing ? "Edit Vehicle" : "Add Vehicle"}
        width="sm:w-[36rem]"
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={vehicle!.id} />}

          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <DrawerRow>
              <TextField
                name="name"
                placeholder="Name"
                defaultValue={vehicle?.name ?? ""}
                errors={state.fieldErrors}
                required
              />
              <SelectField
                name="vehicle_type_id"
                placeholder="Type"
                defaultValue={vehicle?.vehicle_type_id ?? undefined}
                options={vehicleTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <DrawerRow>
              <TextField
                name="make"
                placeholder="Make"
                defaultValue={vehicle?.make ?? ""}
                errors={state.fieldErrors}
              />
              <TextField
                name="model"
                placeholder="Model"
                defaultValue={vehicle?.model ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <div className="grid grid-cols-3 gap-3.5">
              <TextField
                name="year"
                inputMode="numeric"
                placeholder="Year"
                defaultValue={vehicle?.year ?? ""}
                errors={state.fieldErrors}
              />
              <TextField
                name="capacity"
                inputMode="numeric"
                placeholder="Capacity"
                defaultValue={vehicle?.capacity ?? ""}
                errors={state.fieldErrors}
                required
              />
              <TextField
                name="registration_number"
                placeholder="License Plate"
                defaultValue={vehicle?.registration_number ?? ""}
                errors={state.fieldErrors}
              />
            </div>

            <DrawerRow>
              <TextField
                name="vin"
                placeholder="VIN"
                defaultValue={vehicle?.vin ?? ""}
                errors={state.fieldErrors}
              />
              <SelectField
                name="garage_id"
                placeholder="Garage"
                defaultValue={vehicle?.garage_id ?? undefined}
                options={garages.map((garage) => ({
                  value: garage.id,
                  label: garage.name,
                }))}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <div className="flex items-center gap-2">
              <ToggleField
                name="is_mock"
                label="Mock vehicle, don't include in availability calculation"
                defaultChecked={vehicle?.is_mock ?? false}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="What is a mock vehicle?">
                    <Info className="size-4 text-ash" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  A placeholder coach used to hold a booking before you know
                  which vehicle will run it. Mock vehicles never block a real
                  one on the dispatch board.
                </TooltipContent>
              </Tooltip>
            </div>

            <AmenityPicker defaultValue={vehicle?.amenities ?? []} />
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={editing ? "Save" : "Submit"} />
          </DrawerFooter>
        </DrawerForm>
      </SideDrawer>
    </>
  );
}

/**
 * Amenity chips toggle in place rather than opening a multi-select. There are
 * eight of them and they never change, so the whole set fits on screen and the
 * quickest interaction is the one with no menu at all.
 */
function AmenityPicker({ defaultValue }: { defaultValue: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const allSelected = selected.length === VEHICLE_AMENITIES.length;

  return (
    <div className="pt-1">
      <div className="mb-2.5 flex items-center gap-3">
        <p className="text-body-sm font-semibold text-ink">Amenities</p>
        <button
          type="button"
          onClick={() =>
            setSelected(allSelected ? [] : [...VEHICLE_AMENITIES])
          }
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal-600 transition-colors hover:text-teal-700"
        >
          <Check className="size-3.5" />
          {allSelected ? "Clear All" : "Select All"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {VEHICLE_AMENITIES.map((amenity) => {
          const on = selected.includes(amenity);
          return (
            <button
              key={amenity}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setSelected(
                  on
                    ? selected.filter((item) => item !== amenity)
                    : [...selected, amenity],
                )
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                on
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-cloud bg-signal-white text-carbon hover:border-fog",
              )}
            >
              {amenity}
              {on ? <X className="size-3" /> : <Plus className="size-3" />}
            </button>
          );
        })}
      </div>

      {selected.map((amenity) => (
        <input key={amenity} type="hidden" name="amenities" value={amenity} />
      ))}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}
